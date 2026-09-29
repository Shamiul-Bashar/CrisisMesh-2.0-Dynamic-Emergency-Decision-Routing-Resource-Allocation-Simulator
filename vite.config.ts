import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process';

import type { IncomingMessage } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomInt } from 'node:crypto';

import nodemailer from 'nodemailer';


/* =========================================================
   SHARED JSON BODY READER
   ========================================================= */

function readJsonBody(
  req: IncomingMessage
): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();

      if (body.length > 20_000) {
        reject(
          new Error('Request body is too large.')
        );
      }
    });

    req.on('end', () => {
      try {
        resolvePromise(
          JSON.parse(body || '{}') as Record<string, unknown>
        );
      } catch {
        reject(
          new Error('Invalid JSON request.')
        );
      }
    });

    req.on('error', reject);
  });
}


/* =========================================================
   C++ SIMULATION BRIDGE
   ========================================================= */

function simulationBridge(): Plugin {
  type Waiter = {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  };

  let child: ChildProcessWithoutNullStreams | null = null;

  let buffer = '';
  let stderrBuffer = '';

  const waiters: Waiter[] = [];

  const REQUEST_TIMEOUT_MS = 8000;


  const rejectPending = (
    message: string
  ) => {
    const error =
      new Error(message);

    while (waiters.length) {
      const waiter =
        waiters.shift()!;

      clearTimeout(
        waiter.timer
      );

      waiter.reject(
        error
      );
    }
  };


  const start = () => {
    if (
      child &&
      !child.killed
    ) {
      return;
    }

    const exeBase =
      resolve(
        process.cwd(),
        'backend',
        'build',
        'crisismesh_simulation_cli'
      );

    const exe =
      existsSync(
        `${exeBase}.exe`
      )
        ? `${exeBase}.exe`
        : exeBase;

    if (
      !existsSync(exe)
    ) {
      return;
    }

    child =
      spawn(
        exe,
        ['--server'],
        {
          stdio: [
            'pipe',
            'pipe',
            'pipe',
          ],
        }
      );

    const spawnedChild =
      child;

    buffer = '';
    stderrBuffer = '';


    child.stdout.on(
      'data',
      (chunk: Buffer) => {
        buffer +=
          chunk.toString();

        const lines =
          buffer.split(
            /\r?\n/
          );

        buffer =
          lines.pop() || '';

        for (
          const line of lines
        ) {
          const waiter =
            waiters.shift();

          if (!waiter) {
            continue;
          }

          clearTimeout(
            waiter.timer
          );

          waiter.resolve(
            line
          );
        }
      }
    );


    child.stderr.on(
      'data',
      (chunk: Buffer) => {
        stderrBuffer =
          `${stderrBuffer}${chunk.toString()}`
            .slice(-2000);
      }
    );


    spawnedChild.on(
      'error',
      (error) => {
        rejectPending(
          `C++ simulation process error: ${error.message}`
        );

        if (
          child ===
          spawnedChild
        ) {
          child = null;
        }
      }
    );


    spawnedChild.on(
      'exit',
      (
        code,
        signal
      ) => {
        const detail =
          stderrBuffer.trim();

        rejectPending(
          `C++ simulation process stopped${
            code !== null
              ? ` (exit ${code})`
              : ''
          }${
            signal
              ? ` (${signal})`
              : ''
          }${
            detail
              ? `: ${detail}`
              : '.'
          }`
        );

        if (
          child ===
          spawnedChild
        ) {
          child = null;
          buffer = '';
          stderrBuffer = '';
        }
      }
    );
  };


  const send = (
    command: string
  ) =>
    new Promise<string>(
      (
        resolvePromise,
        reject
      ) => {
        start();

        if (!child) {
          reject(
            new Error(
              'C++ simulation executable not found. Build backend first.'
            )
          );

          return;
        }

        const timer =
          setTimeout(
            () => {
              const message =
                'C++ Simulation Development Bridge timed out waiting for a response.';

              rejectPending(
                message
              );

              if (
                child &&
                !child.killed
              ) {
                child.kill();
              }
            },
            REQUEST_TIMEOUT_MS
          );

        waiters.push({
          resolve:
            resolvePromise,

          reject,

          timer,
        });

        try {
          child.stdin.write(
            `${command}\n`
          );

        } catch (error) {
          clearTimeout(
            timer
          );

          const index =
            waiters.findIndex(
              (item) =>
                item.resolve ===
                resolvePromise
            );

          if (
            index >= 0
          ) {
            waiters.splice(
              index,
              1
            );
          }

          reject(
            error instanceof Error
              ? error
              : new Error(
                  String(error)
                )
          );
        }
      }
    );


  return {
    name:
      'crisismesh-simulation-bridge',

    closeBundle() {
      rejectPending('Simulation bridge closed.');
      child?.kill();
      child = null;
    },

    configureServer(server) {
      server.middlewares.use(
        '/api/simulation',

        (req, res) => {
          if (
            req.method !==
            'POST'
          ) {
            res.statusCode =
              405;

            res.setHeader(
              'Content-Type',
              'application/json'
            );

            res.end(
              JSON.stringify({
                ok: false,

                error:
                  'POST is required for the simulation bridge.',
              })
            );

            return;
          }


          let body = '';

          req.on(
            'data',
            (
              chunk: Buffer
            ) => {
              body +=
                chunk.toString();
            }
          );


          req.on(
            'end',

            async () => {
              try {
                const input =
                  JSON.parse(
                    body || '{}'
                  ) as Record<
                    string,
                    unknown
                  >;

                const action =
                  String(
                    input.action ??
                    'STATE'
                  );


                /*
                 * Protect the line-based C++ protocol.
                 *
                 * Pipe separates arguments.
                 * CR/LF terminates a command.
                 */
                const clean = (
                  value: unknown
                ) =>
                  String(
                    value ?? ''
                  )
                    .replace(
                      /\\/g,
                      '/'
                    )
                    .replace(
                      /\|/g,
                      ' '
                    )
                    .replace(
                      /[\r\n]+/g,
                      ' '
                    )
                    .trim();


                let command:
                  string;


                switch (action) {

                  /* =============================
                     GET ENGINE STATE
                     ============================= */

                  case 'STATE':
                    command =
                      'STATE';

                    break;

                  case 'ANALYZE_BFS':
                  case 'ANALYZE_DFS':
                  case 'ANALYZE_DIJKSTRA':
                    command = `${action}|${clean(input.source)}|${clean(input.destination)}`;
                    break;


                  /* =============================
                     REPORT EMERGENCY

                     IMPORTANT:
                     reportedByUserId is now
                     forwarded into C++.
                     ============================= */

                  case 'REPORT':
                    if (!clean(input.reportedByUserId)) {
                      throw new Error('A reporting citizen must be selected.');
                    }
                    command =
                      `REPORT|` +
                      `${clean(input.type)}|` +
                      `${clean(input.locationId)}|` +
                      `${clean(input.severity)}|` +
                      `${clean(input.urgency)}|` +
                      `${clean(input.victimCount)}|` +
                      `${clean(input.description)}|` +
                      `${clean(input.reportedByUserId)}`;

                    break;


                  /* =============================
                     PROCESS PRIORITY QUEUE
                     ============================= */

                  case 'PROCESS_NEXT':
                    command =
                      'PROCESS_NEXT';

                    break;


                  /* =============================
                     ROAD CONTROL
                     ============================= */

                  case 'BLOCK':
                    command =
                      `BLOCK|${clean(
                        input.edgeId
                      )}`;

                    break;


                  case 'UNBLOCK':
                    command =
                      `UNBLOCK|${clean(
                        input.edgeId
                      )}`;

                    break;


                  case 'UNDO_BLOCK':
                    command =
                      'UNDO_BLOCK';

                    break;


                  /* =============================
                     RESPONDER CONTROL
                     ============================= */

                  case 'SET_RESPONDER':
                    command =
                      `SET_RESPONDER|` +
                      `${clean(
                        input.responderId
                      )}|` +
                      `${clean(
                        input.availability
                      )}`;

                    break;


                  /* =============================
                     LEGACY DIRECT RESOLVE

                     Kept for compatibility.
                     New UI should eventually use
                     RESPONSE_COMPLETED instead.
                     ============================= */

                  case 'RESOLVE':
                    command =
                      `RESOLVE|${clean(
                        input.incidentId
                      )}`;

                    break;


                  /* =============================
                     NEW:
                     AUTHOR FINISHES RESPONSE
                     ============================= */

                  case 'RESPONSE_COMPLETED':
                    command =
                      `RESPONSE_COMPLETED|` +
                      `${clean(
                        input.incidentId
                      )}`;

                    break;


                  /* =============================
                     NEW:
                     USER SAYS YES
                     ============================= */

                  case 'CONFIRM_RESOLVED':
                    command =
                      `CONFIRM_RESOLVED|` +
                      `${clean(
                        input.incidentId
                      )}|` +
                      `${clean(
                        input.userId
                      )}`;

                    break;


                  /* =============================
                     NEW:
                     USER SAYS NO
                     ============================= */

                  case 'ESCALATE':
                    command =
                      `ESCALATE|` +
                      `${clean(
                        input.incidentId
                      )}|` +
                      `${clean(
                        input.userId
                      )}|` +
                      `${clean(
                        input.reason
                      )}`;

                    break;


                  /* =============================
                     RESET
                     ============================= */

                  case 'RESET':
                    command =
                      'RESET';

                    break;


                  default:
                    res.statusCode =
                      400;

                    res.setHeader(
                      'Content-Type',
                      'application/json'
                    );

                    res.end(
                      JSON.stringify({
                        ok: false,

                        error:
                          `Unsupported simulation action: ${action}`,
                      })
                    );

                    return;
                }


                const raw =
                  await send(
                    command
                  );


                let parsed:
                  unknown;

                try {
                  parsed =
                    JSON.parse(raw);

                } catch {
                  throw new Error(
                    'The C++ simulation bridge returned malformed JSON.'
                  );
                }


                if (!parsed || typeof parsed !== 'object') {
                  throw new Error(
                    'The C++ simulation bridge returned an invalid response object.'
                  );
                }

                const envelope = parsed as Record<string, unknown>;
                if (
                  typeof envelope.ok !== 'boolean' ||
                  !Array.isArray(envelope.events) ||
                  !Object.prototype.hasOwnProperty.call(envelope, 'state') ||
                  !Object.prototype.hasOwnProperty.call(envelope, 'result') ||
                  (envelope.ok && (!envelope.state || typeof envelope.state !== 'object')) ||
                  (!envelope.ok && envelope.state !== null)
                ) {
                  throw new Error(
                    'The C++ simulation bridge returned an invalid response contract.'
                  );
                }


                res.setHeader(
                  'Content-Type',
                  'application/json'
                );

                res.end(raw);

              } catch (
                error: unknown
              ) {
                res.statusCode =
                  503;

                res.setHeader(
                  'Content-Type',
                  'application/json'
                );

                const message =
                  error instanceof Error
                    ? error.message
                    : String(error);

                res.end(
                  JSON.stringify({
                    ok: false,
                    error:
                      message,
                    state: null,
                    events: [],
                    result: null,
                  })
                );
              }
            }
          );
        }
      );
    },
  };
}


/* =========================================================
   AUTHOR EMAIL OTP
   ========================================================= */

type OtpRecord = {
  code: string;
  expiresAt: number;
  attemptsRemaining: number;
};


function authorEmailOtpBridge(
  env: Record<
    string,
    string
  >
): Plugin {

  const otpStore =
    new Map<
      string,
      OtpRecord
    >();


  const OTP_EXPIRY_MS =
    60 * 1000;

  const MAX_OTP_ATTEMPTS =
    5;


  const emailUser =
    env.EMAIL_USER
      ?.trim() ||
    '';


  const emailAppPassword =
    env.EMAIL_APP_PASSWORD
      ?.replace(
        /\s+/g,
        ''
      )
      .trim() ||
    '';


  const authorRecoveryEmail =
    (
      env.AUTHOR_RECOVERY_EMAIL ||
      env.EMAIL_USER ||
      ''
    )
      .trim()
      .toLowerCase();


  const transporter =
    emailUser &&
    emailAppPassword

      ? nodemailer
          .createTransport({
            service:
              'gmail',

            auth: {
              user:
                emailUser,

              pass:
                emailAppPassword,
            },
          })

      : null;


  return {
    name:
      'crisismesh-author-email-otp',

    configureServer(server) {

      /* =====================================================
         SEND OTP
         ===================================================== */

      server.middlewares.use(
        '/api/auth/send-author-otp',

        async (
          req,
          res
        ) => {

          res.setHeader(
            'Content-Type',
            'application/json'
          );


          if (
            req.method !==
            'POST'
          ) {
            res.statusCode =
              405;

            res.end(
              JSON.stringify({
                ok: false,

                error:
                  'POST is required.',
              })
            );

            return;
          }


          try {

            if (
              !emailUser ||
              !emailAppPassword ||
              !authorRecoveryEmail
            ) {
              throw new Error(
                'Email service is not configured. Check the .env file.'
              );
            }


            if (
              !transporter
            ) {
              throw new Error(
                'Email transporter is unavailable.'
              );
            }


            const input =
              await readJsonBody(
                req
              );


            const requestedEmail =
              String(
                input.email ??
                ''
              )
                .trim()
                .toLowerCase();


            if (
              !requestedEmail
            ) {
              res.statusCode =
                400;

              res.end(
                JSON.stringify({
                  ok: false,

                  error:
                    'Recovery email is required.',
                })
              );

              return;
            }


            if (
              requestedEmail !==
              authorRecoveryEmail
            ) {
              res.statusCode =
                403;

              res.end(
                JSON.stringify({
                  ok: false,

                  error:
                    'The entered email does not match the registered Author recovery email.',
                })
              );

              return;
            }


            const existing =
              otpStore.get(
                requestedEmail
              );


            if (
              existing &&
              existing.expiresAt >
                Date.now()
            ) {

              const secondsRemaining =
                Math.ceil(
                  (
                    existing.expiresAt -
                    Date.now()
                  ) / 1000
                );


              res.statusCode =
                429;


              res.end(
                JSON.stringify({
                  ok: false,

                  error:
                    `A verification code was already sent. ` +
                    `Please wait ${secondsRemaining} second(s) before requesting another one.`,

                  secondsRemaining,
                })
              );

              return;
            }


            const otp =
              String(
                randomInt(
                  100000,
                  1000000
                )
              );


            const expiresAt =
              Date.now() +
              OTP_EXPIRY_MS;


            otpStore.set(
              requestedEmail,
              {
                code: otp,

                expiresAt,

                attemptsRemaining:
                  MAX_OTP_ATTEMPTS,
              }
            );


            try {

              await transporter
                .sendMail({

                  from:
                    `"CrisisMesh 2.0" <${emailUser}>`,

                  to:
                    requestedEmail,

                  subject:
                    'CrisisMesh 2.0 — Password Reset Verification',

                  text: [
                    'CrisisMesh 2.0',
                    'Emergency Operations Center',
                    '',
                    'Password Reset Verification',
                    '',
                    `Your verification code is: ${otp}`,
                    '',
                    'This code will expire in 60 seconds.',
                    '',
                    'If you did not request a password reset, you can safely ignore this email.',
                  ].join('\n'),


                  html: `
                    <div
                      style="
                        font-family: Arial, Helvetica, sans-serif;
                        max-width: 560px;
                        margin: 0 auto;
                        padding: 32px;
                        color: #111827;
                      "
                    >

                      <h2>
                        CrisisMesh 2.0
                      </h2>

                      <p
                        style="
                          color: #6b7280;
                        "
                      >
                        Emergency Operations Center
                      </p>

                      <hr
                        style="
                          border: 0;
                          border-top: 1px solid #e5e7eb;
                          margin: 24px 0;
                        "
                      />

                      <h3>
                        Password Reset Verification
                      </h3>

                      <p>
                        Use this verification code
                        to reset your Author password.
                      </p>

                      <div
                        style="
                          margin: 28px 0;
                          padding: 20px;
                          text-align: center;
                          background: #f3f4f6;
                          border-radius: 10px;
                          font-size: 32px;
                          font-weight: 700;
                          letter-spacing: 8px;
                        "
                      >
                        ${otp}
                      </div>

                      <p>
                        This code expires in
                        <strong>
                          60 seconds
                        </strong>.
                      </p>

                      <p
                        style="
                          margin-top: 28px;
                          font-size: 13px;
                          color: #6b7280;
                        "
                      >
                        If you did not request
                        this reset, ignore this email.
                      </p>

                    </div>
                  `,
                });

            } catch (
              emailError
            ) {

              otpStore.delete(
                requestedEmail
              );

              throw emailError;
            }


            res.statusCode =
              200;


            res.end(
              JSON.stringify({
                ok: true,

                message:
                  'Verification code sent successfully.',

                expiresInSeconds:
                  60,
              })
            );

          } catch (
            error
          ) {

            const message =
              error instanceof Error
                ? error.message
                : String(error);


            console.error(
              '[CrisisMesh Email OTP]',
              message
            );


            res.statusCode =
              500;


            res.end(
              JSON.stringify({
                ok: false,

                error:
                  'Unable to send the verification email. Check the email configuration and try again.',
              })
            );
          }
        }
      );


      /* =====================================================
         VERIFY OTP
         ===================================================== */

      server.middlewares.use(
        '/api/auth/verify-author-otp',

        async (
          req,
          res
        ) => {

          res.setHeader(
            'Content-Type',
            'application/json'
          );


          if (
            req.method !==
            'POST'
          ) {
            res.statusCode =
              405;

            res.end(
              JSON.stringify({
                ok: false,

                error:
                  'POST is required.',
              })
            );

            return;
          }


          try {

            const input =
              await readJsonBody(
                req
              );


            const requestedEmail =
              String(
                input.email ??
                ''
              )
                .trim()
                .toLowerCase();


            const submittedOtp =
              String(
                input.otp ??
                ''
              )
                .trim();


            if (
              !requestedEmail ||
              !submittedOtp
            ) {

              res.statusCode =
                400;

              res.end(
                JSON.stringify({
                  ok: false,

                  error:
                    'Email and verification code are required.',
                })
              );

              return;
            }


            if (
              requestedEmail !==
              authorRecoveryEmail
            ) {

              res.statusCode =
                403;

              res.end(
                JSON.stringify({
                  ok: false,

                  error:
                    'Invalid recovery request.',
                })
              );

              return;
            }


            const record =
              otpStore.get(
                requestedEmail
              );


            if (!record) {

              res.statusCode =
                400;

              res.end(
                JSON.stringify({
                  ok: false,

                  error:
                    'No active verification code was found. Request a new code.',
                })
              );

              return;
            }


            if (
              Date.now() >
              record.expiresAt
            ) {

              otpStore.delete(
                requestedEmail
              );

              res.statusCode =
                410;

              res.end(
                JSON.stringify({
                  ok: false,

                  error:
                    'The verification code has expired. Request a new code.',
                })
              );

              return;
            }


            if (
              submittedOtp !==
              record.code
            ) {

              record
                .attemptsRemaining -= 1;


              if (
                record
                  .attemptsRemaining <=
                0
              ) {

                otpStore.delete(
                  requestedEmail
                );

                res.statusCode =
                  429;

                res.end(
                  JSON.stringify({
                    ok: false,

                    error:
                      'Too many incorrect attempts. Request a new verification code.',
                  })
                );

                return;
              }


              otpStore.set(
                requestedEmail,
                record
              );


              res.statusCode =
                401;


              res.end(
                JSON.stringify({
                  ok: false,

                  error:
                    `Incorrect verification code. ` +
                    `${record.attemptsRemaining} attempt(s) remaining.`,

                  attemptsRemaining:
                    record.attemptsRemaining,
                })
              );

              return;
            }


            /*
             * Correct OTP.
             * Remove immediately so it cannot be reused.
             */
            otpStore.delete(
              requestedEmail
            );


            res.statusCode =
              200;


            res.end(
              JSON.stringify({
                ok: true,

                verified: true,

                message:
                  'Email verification successful.',
              })
            );

          } catch (
            error
          ) {

            const message =
              error instanceof Error
                ? error.message
                : String(error);


            console.error(
              '[CrisisMesh OTP Verification]',
              message
            );


            res.statusCode =
              500;


            res.end(
              JSON.stringify({
                ok: false,

                error:
                  'Unable to verify the code.',
              })
            );
          }
        }
      );
    },
  };
}


/* =========================================================
   VITE
   ========================================================= */

export default defineConfig(
  ({ mode }) => {

    const env =
      loadEnv(
        mode,
        process.cwd(),
        ''
      );


    return {
      plugins: [
        react(),

        simulationBridge(),

        authorEmailOtpBridge(
          env
        ),
      ],
    };
  }
);
