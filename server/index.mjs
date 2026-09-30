import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomInt } from 'node:crypto';
import nodemailer from 'nodemailer';

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 20_000;
const OTP_EXPIRY_MS = 60_000;
const MAX_OTP_ATTEMPTS = 5;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
const resendFromEmail = (process.env.RESEND_FROM_EMAIL || 'CrisisMesh 2.0 <onboarding@resend.dev>').trim();
const emailUser = (process.env.EMAIL_USER || '').trim();
const emailAppPassword = (process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '').trim();
const authorRecoveryEmail = (process.env.AUTHOR_RECOVERY_EMAIL || process.env.EMAIL_USER || '').trim().toLowerCase();

const transporter = emailUser && emailAppPassword
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: emailUser, pass: emailAppPassword } })
  : null;

const otpStore = new Map();

function buildOtpEmailText(otp) {
  return [
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
  ].join('\n');
}

async function sendRecoveryOtpEmail(to, otp) {
  const subject = 'CrisisMesh 2.0 — Password Reset Verification';
  const text = buildOtpEmailText(otp);

  if (resendApiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      let detail = '';
      try {
        const payload = await response.json();
        detail = payload?.message ? `: ${payload.message}` : '';
      } catch {
        // Resend may return a non-JSON error body; status code is still enough for diagnostics.
      }
      throw new Error(`Resend API failed with HTTP ${response.status}${detail}`);
    }

    return 'resend';
  }

  if (transporter) {
    await transporter.sendMail({
      from: `"CrisisMesh 2.0" <${emailUser}>`,
      to,
      subject,
      text,
    });
    return 'gmail-smtp';
  }

  throw new Error('Email service is not configured. Set RESEND_API_KEY or Gmail SMTP variables.');
}

const executableBase = process.env.SIMULATION_CLI_PATH
  ? resolve(process.env.SIMULATION_CLI_PATH)
  : resolve(process.cwd(), 'backend', 'build', 'crisismesh_simulation_cli');
const executablePath = existsSync(`${executableBase}.exe`) ? `${executableBase}.exe` : executableBase;

let child = null;
let stdoutBuffer = '';
let stderrBuffer = '';
const waiters = [];

function rejectPending(message) {
  const error = new Error(message);
  while (waiters.length) {
    const waiter = waiters.shift();
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }
}

function startEngine() {
  if (child && !child.killed) return child;
  if (!existsSync(executablePath)) {
    throw new Error(`C++ simulation executable not found at ${executablePath}`);
  }

  child = spawn(executablePath, ['--server'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const spawnedChild = child;
  stdoutBuffer = '';
  stderrBuffer = '';

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      const waiter = waiters.shift();
      if (!waiter) continue;
      clearTimeout(waiter.timer);
      waiter.resolve(line);
    }
  });

  child.stderr.on('data', (chunk) => {
    stderrBuffer = `${stderrBuffer}${chunk.toString()}`.slice(-4000);
  });

  spawnedChild.on('error', (error) => {
    rejectPending(`C++ simulation process error: ${error.message}`);
    if (child === spawnedChild) child = null;
  });

  spawnedChild.on('exit', (code, signal) => {
    const detail = stderrBuffer.trim();
    rejectPending(
      `C++ simulation process stopped${code !== null ? ` (exit ${code})` : ''}${signal ? ` (${signal})` : ''}${detail ? `: ${detail}` : '.'}`,
    );
    if (child === spawnedChild) {
      child = null;
      stdoutBuffer = '';
      stderrBuffer = '';
    }
  });

  return child;
}

function sendCommand(command) {
  return new Promise((resolvePromise, reject) => {
    try {
      startEngine();
    } catch (error) {
      reject(error);
      return;
    }

    const timer = setTimeout(() => {
      rejectPending('C++ simulation service timed out waiting for a response.');
      if (child && !child.killed) child.kill();
    }, REQUEST_TIMEOUT_MS);

    waiters.push({ resolve: resolvePromise, reject, timer });

    try {
      child.stdin.write(`${command}\n`);
    } catch (error) {
      clearTimeout(timer);
      const index = waiters.findIndex((item) => item.resolve === resolvePromise);
      if (index >= 0) waiters.splice(index, 1);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function clean(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/\|/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function commandFromPayload(input) {
  const action = String(input.action ?? 'STATE');

  switch (action) {
    case 'STATE':
      return 'STATE';
    case 'ANALYZE_BFS':
    case 'ANALYZE_DFS':
    case 'ANALYZE_DIJKSTRA':
      return `${action}|${clean(input.source)}|${clean(input.destination)}`;
    case 'REPORT':
      if (!clean(input.reportedByUserId)) throw new Error('A reporting citizen must be selected.');
      return `REPORT|${clean(input.type)}|${clean(input.locationId)}|${clean(input.severity)}|${clean(input.urgency)}|${clean(input.victimCount)}|${clean(input.description)}|${clean(input.reportedByUserId)}`;
    case 'PROCESS_NEXT':
      return 'PROCESS_NEXT';
    case 'BLOCK':
      return `BLOCK|${clean(input.edgeId)}`;
    case 'UNBLOCK':
      return `UNBLOCK|${clean(input.edgeId)}`;
    case 'UNDO_BLOCK':
      return 'UNDO_BLOCK';
    case 'SET_RESPONDER':
      return `SET_RESPONDER|${clean(input.responderId)}|${clean(input.availability)}`;
    case 'RESOLVE':
      return `RESOLVE|${clean(input.incidentId)}`;
    case 'RESPONSE_COMPLETED':
      return `RESPONSE_COMPLETED|${clean(input.incidentId)}`;
    case 'CONFIRM_RESOLVED':
      return `CONFIRM_RESOLVED|${clean(input.incidentId)}|${clean(input.userId)}`;
    case 'ESCALATE':
      return `ESCALATE|${clean(input.incidentId)}|${clean(input.userId)}|${clean(input.reason)}`;
    case 'RESET':
      return 'RESET';
    default:
      throw new Error(`Unsupported simulation action: ${action}`);
  }
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(origin);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  return await new Promise((resolvePromise, reject) => {
    let body = '';
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      body += chunk.toString();
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        settled = true;
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolvePromise(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON request.'));
      }
    });

    req.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

async function handleSimulation(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'POST is required for the simulation service.', state: null, events: [], result: null });
    return;
  }

  try {
    const input = await readJsonBody(req);
    const command = commandFromPayload(input);
    const raw = await sendCommand(command);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('The C++ simulation service returned malformed JSON.');
    }

    if (!parsed || typeof parsed !== 'object') throw new Error('The C++ simulation service returned an invalid response object.');

    const envelope = parsed;
    if (
      typeof envelope.ok !== 'boolean' ||
      !Array.isArray(envelope.events) ||
      !Object.prototype.hasOwnProperty.call(envelope, 'state') ||
      !Object.prototype.hasOwnProperty.call(envelope, 'result') ||
      (envelope.ok && (!envelope.state || typeof envelope.state !== 'object')) ||
      (!envelope.ok && envelope.state !== null)
    ) {
      throw new Error('The C++ simulation service returned an invalid response contract.');
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith('Unsupported simulation action:') ? 400 : 503;
    sendJson(res, status, { ok: false, error: message, state: null, events: [], result: null });
  }
}

async function handleSendAuthorOtp(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'POST is required.' });
    return;
  }

  try {
    if (!authorRecoveryEmail || (!resendApiKey && !transporter)) {
      throw new Error('Email service is not configured.');
    }

    const input = await readJsonBody(req);
    const requestedEmail = String(input.email ?? '').trim().toLowerCase();

    if (!requestedEmail) {
      sendJson(res, 400, { ok: false, error: 'Recovery email is required.' });
      return;
    }

    if (requestedEmail !== authorRecoveryEmail) {
      sendJson(res, 403, { ok: false, error: 'The entered email does not match the registered Author recovery email.' });
      return;
    }

    const existing = otpStore.get(requestedEmail);
    if (existing && existing.expiresAt > Date.now()) {
      const secondsRemaining = Math.ceil((existing.expiresAt - Date.now()) / 1000);
      sendJson(res, 429, {
        ok: false,
        error: `A verification code was already sent. Please wait ${secondsRemaining} second(s) before requesting another one.`,
        secondsRemaining,
      });
      return;
    }

    const otp = String(randomInt(100000, 1000000));
    const expiresAt = Date.now() + OTP_EXPIRY_MS;
    otpStore.set(requestedEmail, { code: otp, expiresAt, attemptsRemaining: MAX_OTP_ATTEMPTS });

    try {
      await sendRecoveryOtpEmail(requestedEmail, otp);
    } catch (error) {
      otpStore.delete(requestedEmail);
      throw error;
    }

    sendJson(res, 200, { ok: true, message: 'Verification code sent successfully.', expiresInSeconds: 60 });
  } catch (error) {
    console.error('[CrisisMesh Email OTP]', error instanceof Error ? error.message : String(error));
    sendJson(res, 500, { ok: false, error: 'Unable to send the verification email. Check the email configuration and try again.' });
  }
}

async function handleVerifyAuthorOtp(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'POST is required.' });
    return;
  }

  try {
    const input = await readJsonBody(req);
    const requestedEmail = String(input.email ?? '').trim().toLowerCase();
    const submittedOtp = String(input.otp ?? '').trim();

    if (!requestedEmail || !submittedOtp) {
      sendJson(res, 400, { ok: false, error: 'Email and verification code are required.' });
      return;
    }

    if (requestedEmail !== authorRecoveryEmail) {
      sendJson(res, 403, { ok: false, error: 'Invalid recovery request.' });
      return;
    }

    const record = otpStore.get(requestedEmail);
    if (!record) {
      sendJson(res, 400, { ok: false, error: 'No active verification code was found. Request a new code.' });
      return;
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(requestedEmail);
      sendJson(res, 410, { ok: false, error: 'The verification code has expired. Request a new code.' });
      return;
    }

    if (submittedOtp !== record.code) {
      record.attemptsRemaining -= 1;
      if (record.attemptsRemaining <= 0) {
        otpStore.delete(requestedEmail);
        sendJson(res, 429, { ok: false, error: 'Too many incorrect attempts. Request a new verification code.' });
        return;
      }

      otpStore.set(requestedEmail, record);
      sendJson(res, 401, {
        ok: false,
        error: `Incorrect verification code. ${record.attemptsRemaining} attempt(s) remaining.`,
        attemptsRemaining: record.attemptsRemaining,
      });
      return;
    }

    otpStore.delete(requestedEmail);
    sendJson(res, 200, { ok: true, verified: true, message: 'Email verification successful.' });
  } catch (error) {
    console.error('[CrisisMesh OTP Verification]', error instanceof Error ? error.message : String(error));
    sendJson(res, 500, { ok: false, error: 'Unable to verify the code.' });
  }
}

const server = createServer(async (req, res) => {
  setCors(req, res);

  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    sendJson(res, 403, { ok: false, error: 'Origin is not allowed.' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'crisismesh-backend',
      engineProcess: child && !child.killed ? 'ONLINE' : 'STARTING_ON_DEMAND',
    });
    return;
  }

  if (url.pathname === '/api/simulation') {
    await handleSimulation(req, res);
    return;
  }

  if (url.pathname === '/api/auth/send-author-otp') {
    await handleSendAuthorOtp(req, res);
    return;
  }

  if (url.pathname === '/api/auth/verify-author-otp') {
    await handleVerifyAuthorOtp(req, res);
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Route not found.' });
});

try {
  startEngine();
} catch (error) {
  console.error('[CrisisMesh Backend]', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[CrisisMesh Backend] listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`[CrisisMesh Backend] ${signal} received; shutting down.`);
  rejectPending('Backend service is shutting down.');
  if (child && !child.killed) child.kill();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
