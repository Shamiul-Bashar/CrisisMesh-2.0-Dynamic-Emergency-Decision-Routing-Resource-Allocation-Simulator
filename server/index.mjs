import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
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
const userDataPath = (process.env.USER_DATA_PATH || '').trim();
const messageDataPath = (process.env.MESSAGE_DATA_PATH || (userDataPath ? resolve(dirname(userDataPath), 'messages.json') : '')).trim();

const transporter = emailUser && emailAppPassword
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: emailUser, pass: emailAppPassword } })
  : null;

const otpStore = new Map();

// Shared online citizen registry and author-to-citizen message bus.
// Both are kept in memory for fast access and persisted to the Railway volume
// when USER_DATA_PATH is configured.
const userStore = new Map();
const messageStore = new Map();

const normalizeEmailValue = (value) => String(value ?? '').trim().toLowerCase();
const normalizePhoneValue = (value) => String(value ?? '').replace(/\D/g, '');
const normalizeUsernameValue = (value) => String(value ?? '').trim().toLowerCase();

function publicUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function normalizeUserInput(input) {
  const user = {
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    username: String(input.username ?? '').trim(),
    phone: normalizePhoneValue(input.phone),
    email: normalizeEmailValue(input.email),
    passwordHash: String(input.passwordHash ?? '').trim(),
    createdAt: Number(input.createdAt) || Date.now(),
    lastLogin: input.lastLogin === null || input.lastLogin === undefined ? null : Number(input.lastLogin) || null,
    accountStatus: input.accountStatus === 'Inactive' ? 'Inactive' : 'Active',
    role: 'user',
  };

  if (!user.id || !user.name || !user.username || !user.phone || !user.email || !user.passwordHash) {
    throw new Error('Complete user identity and credential fields are required.');
  }

  return user;
}

function findUserByIdentity(identity) {
  const username = normalizeUsernameValue(identity);
  const email = normalizeEmailValue(identity);
  return [...userStore.values()].find((user) =>
    normalizeUsernameValue(user.username) === username || normalizeEmailValue(user.email) === email
  ) ?? null;
}

function identityConflict(candidate) {
  return [...userStore.values()].find((user) =>
    user.id !== candidate.id && (
      normalizeUsernameValue(user.username) === normalizeUsernameValue(candidate.username) ||
      normalizeEmailValue(user.email) === normalizeEmailValue(candidate.email) ||
      normalizePhoneValue(user.phone) === normalizePhoneValue(candidate.phone)
    )
  ) ?? null;
}

function persistUserStore() {
  if (!userDataPath) return;
  mkdirSync(dirname(userDataPath), { recursive: true });
  writeFileSync(userDataPath, JSON.stringify([...userStore.values()], null, 2), 'utf8');
}

function loadUserStore() {
  if (!userDataPath || !existsSync(userDataPath)) return;
  try {
    const parsed = JSON.parse(readFileSync(userDataPath, 'utf8'));
    if (!Array.isArray(parsed)) return;
    for (const raw of parsed) {
      try {
        const user = normalizeUserInput(raw);
        userStore.set(user.id, user);
      } catch {
        // Ignore malformed legacy records and keep loading valid users.
      }
    }
    console.log(`[CrisisMesh Users] loaded ${userStore.size} persisted user(s).`);
  } catch (error) {
    console.error('[CrisisMesh Users] unable to load persisted users:', error instanceof Error ? error.message : String(error));
  }
}

loadUserStore();

function normalizeMessageInput(input) {
  const recipientId = String(input.recipientId ?? '').trim();
  const senderId = String(input.senderId ?? 'author').trim() || 'author';
  const senderName = String(input.senderName ?? 'Author Console').trim() || 'Author Console';
  const subject = String(input.subject ?? '').trim().slice(0, 80) || 'Operations update';
  const body = String(input.body ?? '').trim().slice(0, 500);
  const type = input.type === 'broadcast' || recipientId === 'all' ? 'broadcast' : 'individual';

  if (!recipientId || !body) throw new Error('Message recipient and body are required.');
  if (senderId !== 'author') throw new Error('Only the Author console can send operational messages.');
  if (recipientId !== 'all' && !userStore.has(recipientId)) {
    throw new Error('The selected recipient is not registered in the shared user registry.');
  }

  return {
    id: String(input.id ?? '').trim() || randomUUID(),
    recipientId,
    senderId,
    senderName,
    subject,
    body,
    createdAt: Number(input.createdAt) || Date.now(),
    read: Boolean(input.read),
    type,
  };
}

function persistMessageStore() {
  if (!messageDataPath) return;
  mkdirSync(dirname(messageDataPath), { recursive: true });
  writeFileSync(messageDataPath, JSON.stringify([...messageStore.values()], null, 2), 'utf8');
}

function loadMessageStore() {
  if (!messageDataPath || !existsSync(messageDataPath)) return;
  try {
    const parsed = JSON.parse(readFileSync(messageDataPath, 'utf8'));
    if (!Array.isArray(parsed)) return;
    for (const raw of parsed) {
      try {
        const message = normalizeMessageInput(raw);
        messageStore.set(message.id, message);
      } catch {
        // Ignore malformed or orphaned legacy messages.
      }
    }
    console.log(`[CrisisMesh Messages] loaded ${messageStore.size} persisted message(s).`);
  } catch (error) {
    console.error('[CrisisMesh Messages] unable to load persisted messages:', error instanceof Error ? error.message : String(error));
  }
}

loadMessageStore();

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

async function handleUsers(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'GET is required.' });
    return;
  }

  const users = [...userStore.values()]
    .map(publicUser)
    .sort((a, b) => (b.lastLogin ?? b.createdAt ?? 0) - (a.lastLogin ?? a.createdAt ?? 0));

  sendJson(res, 200, { ok: true, users });
}

async function handleUserAvailability(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'POST is required.' });
    return;
  }

  try {
    const input = await readJsonBody(req);
    const username = normalizeUsernameValue(input.username);
    const email = normalizeEmailValue(input.email);
    const phone = normalizePhoneValue(input.phone);

    const conflicts = {
      username: [...userStore.values()].some((user) => normalizeUsernameValue(user.username) === username),
      email: [...userStore.values()].some((user) => normalizeEmailValue(user.email) === email),
      phone: [...userStore.values()].some((user) => normalizePhoneValue(user.phone) === phone),
    };

    sendJson(res, 200, { ok: true, available: !Object.values(conflicts).some(Boolean), conflicts });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Unable to check account availability.' });
  }
}

async function handleUserSync(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'POST is required.' });
    return;
  }

  try {
    const input = await readJsonBody(req);
    const candidate = normalizeUserInput(input.user ?? input);
    const conflict = identityConflict(candidate);

    if (conflict) {
      sendJson(res, 409, { ok: false, error: 'A different account already uses this username, email, or phone number.' });
      return;
    }

    const existing = userStore.get(candidate.id);
    const merged = {
      ...existing,
      ...candidate,
      createdAt: existing?.createdAt ?? candidate.createdAt,
      lastLogin: Math.max(existing?.lastLogin ?? 0, candidate.lastLogin ?? 0) || null,
    };
    userStore.set(merged.id, merged);
    persistUserStore();

    sendJson(res, 200, { ok: true, user: publicUser(merged) });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Unable to synchronize user.' });
  }
}

async function handleUserLogin(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'POST is required.' });
    return;
  }

  try {
    const input = await readJsonBody(req);
    const identity = String(input.identity ?? '').trim();
    const passwordHash = String(input.passwordHash ?? '').trim();
    const user = findUserByIdentity(identity);

    if (!user) {
      sendJson(res, 404, { ok: false, error: 'Online account not found.' });
      return;
    }

    if (!passwordHash || user.passwordHash !== passwordHash) {
      sendJson(res, 401, { ok: false, error: 'Invalid username/email or password.' });
      return;
    }

    const updated = { ...user, lastLogin: Date.now(), accountStatus: 'Active' };
    userStore.set(updated.id, updated);
    persistUserStore();
    sendJson(res, 200, { ok: true, user: publicUser(updated) });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Unable to sign in.' });
  }
}

async function handleUserPassword(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'POST is required.' });
    return;
  }

  try {
    const input = await readJsonBody(req);
    const userId = String(input.userId ?? '').trim();
    const passwordHash = String(input.passwordHash ?? '').trim();
    const user = userStore.get(userId);

    if (!user || !passwordHash) {
      sendJson(res, 404, { ok: false, error: 'The intended online account could not be found.' });
      return;
    }

    userStore.set(userId, { ...user, passwordHash });
    persistUserStore();
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Unable to update password.' });
  }
}

async function handleMessages(req, res, url) {
  if (req.method === 'GET') {
    const scope = String(url.searchParams.get('scope') ?? '').trim();
    const userId = String(url.searchParams.get('userId') ?? '').trim();

    if (scope === 'author') {
      const messages = [...messageStore.values()].sort((a, b) => b.createdAt - a.createdAt);
      sendJson(res, 200, { ok: true, messages });
      return;
    }

    if (!userId || !userStore.has(userId)) {
      sendJson(res, 400, { ok: false, error: 'A registered userId is required.' });
      return;
    }

    const messages = [...messageStore.values()]
      .filter((message) => message.recipientId === userId || message.recipientId === 'all')
      .sort((a, b) => b.createdAt - a.createdAt);

    sendJson(res, 200, { ok: true, messages });
    return;
  }

  if (req.method === 'POST') {
    try {
      const input = await readJsonBody(req);
      const message = normalizeMessageInput(input.message ?? input);
      messageStore.set(message.id, message);
      persistMessageStore();
      sendJson(res, 200, { ok: true, message });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Unable to send the message.' });
    }
    return;
  }

  sendJson(res, 405, { ok: false, error: 'GET or POST is required.' });
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
      userRegistry: userDataPath ? 'PERSISTENT' : 'MEMORY',
      registeredUsers: userStore.size,
      messageBus: messageDataPath ? 'PERSISTENT' : 'MEMORY',
      storedMessages: messageStore.size,
    });
    return;
  }

  if (url.pathname === '/api/simulation') {
    await handleSimulation(req, res);
    return;
  }

  if (url.pathname === '/api/users') {
    await handleUsers(req, res);
    return;
  }

  if (url.pathname === '/api/users/check') {
    await handleUserAvailability(req, res);
    return;
  }

  if (url.pathname === '/api/users/sync') {
    await handleUserSync(req, res);
    return;
  }

  if (url.pathname === '/api/users/login') {
    await handleUserLogin(req, res);
    return;
  }

  if (url.pathname === '/api/users/password') {
    await handleUserPassword(req, res);
    return;
  }

  if (url.pathname === '/api/messages') {
    await handleMessages(req, res, url);
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
