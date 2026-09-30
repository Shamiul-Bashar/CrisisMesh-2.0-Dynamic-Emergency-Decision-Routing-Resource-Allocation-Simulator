import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authenticateUser,
  hashPassword,
  readSession,
  readUsers,
  updateUserPassword,
  writeAuthorPasswordVerified,
  writeSessionVerified,
  writeUsersVerified,
  type StorageLike,
  type StoredUser,
} from '../core/auth/credentials.ts';
import { isActiveOperationalIncident } from '../core/simulation/selectors.ts';
import type { SimulationIncident } from '../core/simulation/types.ts';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  private readonly discardWrites: boolean;
  constructor(discardWrites = false) { this.discardWrites = discardWrites; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (!this.discardWrites) this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

async function registeredUser(): Promise<StoredUser> {
  return {
    id: 'citizen-42',
    name: 'Test Citizen',
    username: 'citizen',
    phone: '01700000000',
    email: 'citizen@example.test',
    passwordHash: await hashPassword('OldPassword1!'),
    createdAt: 10,
    lastLogin: null,
    accountStatus: 'Active',
    role: 'user',
  };
}

test('returning login and registration sessions retain the real user ID', async () => {
  const storage = new MemoryStorage();
  const user = await registeredUser();
  writeUsersVerified(storage, [user]);

  const authenticated = await authenticateUser(storage, user.email, 'OldPassword1!');
  assert.equal(authenticated?.id, user.id);
  writeSessionVerified(storage, 'user', authenticated!.id, 20);
  assert.deepEqual(readSession(storage), {
    role: 'user', establishedAt: 20, userId: user.id,
  });

  storage.removeItem('cm-session');
  writeSessionVerified(storage, 'user', user.id, 30);
  assert.equal(readSession(storage)?.userId, user.id);
});

test('user password reset changes only the credential and survives a new read', async () => {
  const storage = new MemoryStorage();
  const user = await registeredUser();
  writeUsersVerified(storage, [user]);
  await updateUserPassword(storage, user.id, 'NewPassword2!');

  assert.equal(await authenticateUser(storage, user.username, 'OldPassword1!'), null);
  assert.equal((await authenticateUser(storage, user.username, 'NewPassword2!'))?.id, user.id);
  const persisted = readUsers(storage)[0];
  assert.equal(persisted.name, user.name);
  assert.equal(persisted.phone, user.phone);
  assert.equal(persisted.createdAt, user.createdAt);
});

test('user reset requires exactly one intended account', async () => {
  const storage = new MemoryStorage();
  await assert.rejects(
    updateUserPassword(storage, 'missing-user', 'NewPassword2!'),
    /uniquely identified/,
  );
});

test('author reset fails when persistence cannot be read back', () => {
  const storage = new MemoryStorage(true);
  assert.throws(
    () => writeAuthorPasswordVerified(storage, 'NewAuthorPassword2!'),
    /could not be persisted/,
  );
});

test('closed incidents are excluded from active operational markers', () => {
  const incident = { status: 'CLOSED' } as SimulationIncident;
  assert.equal(isActiveOperationalIncident(incident), false);
  assert.equal(isActiveOperationalIncident({ ...incident, status: 'AWAITING_USER_CONFIRMATION' }), true);
});
