import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

async function freePort() {
  const server = createNetServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function startBackend(dataDir) {
  const port = await freePort();
  const userDataPath = join(dataDir, 'users.json');
  const messageDataPath = join(dataDir, 'messages.json');
  const child = spawn(process.execPath, [resolve('server', 'index.mjs')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      USER_DATA_PATH: userDataPath,
      MESSAGE_DATA_PATH: messageDataPath,
      ALLOWED_ORIGINS: '*',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let diagnostics = '';
  child.stdout.on('data', (chunk) => { diagnostics += chunk.toString(); });
  child.stderr.on('data', (chunk) => { diagnostics += chunk.toString(); });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Backend exited early: ${diagnostics}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return { child, baseUrl, diagnostics: () => diagnostics };
    } catch {
      // Service is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  child.kill('SIGTERM');
  throw new Error(`Backend did not become ready: ${diagnostics}`);
}

async function stopBackend(instance) {
  if (instance.child.exitCode !== null) return;
  instance.child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => instance.child.once('exit', resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 3000)),
  ]);
  if (instance.child.exitCode === null) instance.child.kill('SIGKILL');
}

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();
  return { response, data };
}

test('shared online users and messages synchronize across devices and persist across backend restart', { timeout: 60000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'crisismesh-online-'));
  let backend;
  try {
    backend = await startBackend(dataDir);

    const userA = {
      id: 'online-user-a',
      name: 'Online User A',
      username: 'onlinea',
      phone: '01700000001',
      email: 'online-a@example.test',
      passwordHash: 'hash-a',
      createdAt: Date.now() - 10_000,
      lastLogin: null,
      accountStatus: 'Active',
      role: 'user',
    };
    const userB = {
      id: 'online-user-b',
      name: 'Online User B',
      username: 'onlineb',
      phone: '01700000002',
      email: 'online-b@example.test',
      passwordHash: 'hash-b',
      createdAt: Date.now() - 5_000,
      lastLogin: null,
      accountStatus: 'Active',
      role: 'user',
    };

    for (const user of [userA, userB]) {
      const { response, data } = await jsonRequest(backend.baseUrl, '/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
      });
      assert.equal(response.status, 200, data.error);
      assert.equal(data.ok, true);
      assert.equal(Object.hasOwn(data.user, 'passwordHash'), false);
    }

    const users = await jsonRequest(backend.baseUrl, '/api/users');
    assert.equal(users.response.status, 200);
    assert.equal(users.data.users.length, 2);
    assert.ok(users.data.users.every((user) => !Object.hasOwn(user, 'passwordHash')));

    const recoveryLookup = await jsonRequest(backend.baseUrl, '/api/users/recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userA.phone }),
    });
    assert.equal(recoveryLookup.response.status, 200, recoveryLookup.data.error);
    assert.equal(recoveryLookup.data.user.id, userA.id);
    assert.equal(Object.hasOwn(recoveryLookup.data.user, 'passwordHash'), false);

    const rejectedPasswordReset = await jsonRequest(backend.baseUrl, '/api/users/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userA.id, phone: '01999999999', passwordHash: 'new-hash-a' }),
    });
    assert.equal(rejectedPasswordReset.response.status, 403);

    const acceptedPasswordReset = await jsonRequest(backend.baseUrl, '/api/users/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userA.id, phone: userA.phone, passwordHash: 'new-hash-a' }),
    });
    assert.equal(acceptedPasswordReset.response.status, 200, acceptedPasswordReset.data.error);
    userA.passwordHash = 'new-hash-a';

    const wrongLogin = await jsonRequest(backend.baseUrl, '/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: userA.email, passwordHash: 'wrong-hash' }),
    });
    assert.equal(wrongLogin.response.status, 401);

    const goodLogin = await jsonRequest(backend.baseUrl, '/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: userA.username, passwordHash: userA.passwordHash }),
    });
    assert.equal(goodLogin.response.status, 200, goodLogin.data.error);
    assert.equal(goodLogin.data.user.id, userA.id);
    assert.equal(Object.hasOwn(goodLogin.data.user, 'passwordHash'), false);

    const direct = {
      id: 'message-direct-a',
      recipientId: userA.id,
      senderId: 'author',
      senderName: 'Author Console',
      subject: 'Direct update',
      body: 'Direct message for user A.',
      createdAt: Date.now(),
      read: false,
      type: 'individual',
    };
    const broadcast = {
      id: 'message-broadcast',
      recipientId: 'all',
      senderId: 'author',
      senderName: 'Author Console',
      subject: 'City advisory',
      body: 'Broadcast message for current registered users.',
      createdAt: Date.now() + 1,
      read: false,
      type: 'broadcast',
    };

    for (const message of [direct, broadcast]) {
      const sent = await jsonRequest(backend.baseUrl, '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      assert.equal(sent.response.status, 200, sent.data.error);
      assert.equal(sent.data.ok, true);
    }

    const unknownRecipient = await jsonRequest(backend.baseUrl, '/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { ...direct, id: 'message-bad-recipient', recipientId: 'missing-user' },
      }),
    });
    assert.equal(unknownRecipient.response.status, 400);

    const inboxA = await jsonRequest(backend.baseUrl, `/api/messages?userId=${encodeURIComponent(userA.id)}`);
    assert.deepEqual(inboxA.data.messages.map((message) => message.id).sort(), [direct.id, broadcast.id].sort());

    const inboxB = await jsonRequest(backend.baseUrl, `/api/messages?userId=${encodeURIComponent(userB.id)}`);
    assert.deepEqual(inboxB.data.messages.map((message) => message.id), [broadcast.id]);

    const authorInbox = await jsonRequest(backend.baseUrl, '/api/messages?scope=author');
    assert.equal(authorInbox.data.messages.length, 2);

    await stopBackend(backend);
    backend = await startBackend(dataDir);

    const health = await jsonRequest(backend.baseUrl, '/health');
    assert.equal(health.data.registeredUsers, 2);
    assert.equal(health.data.storedMessages, 2);
    assert.equal(health.data.userRegistry, 'PERSISTENT');
    assert.equal(health.data.messageBus, 'PERSISTENT');

    const persistedUsers = await jsonRequest(backend.baseUrl, '/api/users');
    assert.equal(persistedUsers.data.users.length, 2);

    const persistedInbox = await jsonRequest(backend.baseUrl, `/api/messages?userId=${encodeURIComponent(userA.id)}`);
    assert.equal(persistedInbox.data.messages.length, 2);

    // A user created after an old broadcast must not receive historical announcements.
    const lateUser = {
      ...userB,
      id: 'online-user-late',
      username: 'onlinelate',
      phone: '01700000003',
      email: 'online-late@example.test',
      createdAt: Date.now() + 5_000,
    };
    const syncedLate = await jsonRequest(backend.baseUrl, '/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: lateUser }),
    });
    assert.equal(syncedLate.response.status, 200, syncedLate.data.error);
    const lateInbox = await jsonRequest(backend.baseUrl, `/api/messages?userId=${encodeURIComponent(lateUser.id)}`);
    assert.deepEqual(lateInbox.data.messages, []);
  } finally {
    if (backend) await stopBackend(backend);
    await rm(dataDir, { recursive: true, force: true });
  }
});
