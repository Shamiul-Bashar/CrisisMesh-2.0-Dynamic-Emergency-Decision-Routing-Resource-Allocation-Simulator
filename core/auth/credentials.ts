export type Role = 'user' | 'author';

export type StoredUser = {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  passwordHash: string;
  createdAt?: number;
  lastLogin?: number | null;
  accountStatus?: 'Active' | 'Inactive';
  role?: 'user';
};

export type StoredSession = {
  role: Role;
  establishedAt: number;
  userId: string;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const USERS_KEY = 'cm-users';
const SESSION_KEY = 'cm-session';
const AUTHOR_PASSWORD_KEY = 'cm-author-password';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const normalizePhone = (value: string) => value.replace(/\D/g, '');
export const normalizeUsername = (value: string) => value.trim().toLowerCase();

export async function hashPassword(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function readUsers(storage: StorageLike): StoredUser[] {
  try {
    const parsed = JSON.parse(storage.getItem(USERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed as StoredUser[] : [];
  } catch {
    return [];
  }
}

export function writeUsersVerified(storage: StorageLike, users: StoredUser[]): void {
  const serialized = JSON.stringify(users);
  storage.setItem(USERS_KEY, serialized);
  if (storage.getItem(USERS_KEY) !== serialized) {
    throw new Error('User credential storage could not be verified.');
  }
}

export function findUserByIdentity(users: StoredUser[], identity: string): StoredUser | null {
  const username = normalizeUsername(identity);
  const email = normalizeEmail(identity);
  return users.find((user) =>
    normalizeUsername(user.username) === username || normalizeEmail(user.email) === email
  ) ?? null;
}

export async function authenticateUser(
  storage: StorageLike,
  identity: string,
  password: string,
): Promise<StoredUser | null> {
  const user = findUserByIdentity(readUsers(storage), identity);
  if (!user || user.passwordHash !== await hashPassword(password)) return null;
  return user;
}

export async function updateUserPassword(
  storage: StorageLike,
  userId: string,
  password: string,
): Promise<StoredUser> {
  const users = readUsers(storage);
  const matches = users.filter((user) => user.id === userId);
  if (matches.length !== 1) {
    throw new Error('The intended user account could not be uniquely identified.');
  }
  const passwordHash = await hashPassword(password);
  const updatedUsers = users.map((user) =>
    user.id === userId ? { ...user, passwordHash } : user
  );
  writeUsersVerified(storage, updatedUsers);
  const verified = readUsers(storage).filter((user) => user.id === userId);
  if (verified.length !== 1 || verified[0].passwordHash !== passwordHash) {
    throw new Error('The updated user credential could not be verified.');
  }
  return verified[0];
}

export function readAuthorPassword(storage: StorageLike, fallback: string): string {
  return storage.getItem(AUTHOR_PASSWORD_KEY) || fallback;
}

export function writeAuthorPasswordVerified(storage: StorageLike, password: string): void {
  storage.setItem(AUTHOR_PASSWORD_KEY, password);
  if (storage.getItem(AUTHOR_PASSWORD_KEY) !== password) {
    throw new Error('The Author password could not be persisted.');
  }
}

export function writeSessionVerified(
  storage: StorageLike,
  role: Role,
  userId: string,
  establishedAt = Date.now(),
): StoredSession {
  if (!userId || (role === 'author' && userId !== 'author')) {
    throw new Error('A verified account identity is required to create a session.');
  }
  const session: StoredSession = { role, establishedAt, userId };
  const serialized = JSON.stringify(session);
  storage.setItem(SESSION_KEY, serialized);
  if (storage.getItem(SESSION_KEY) !== serialized) {
    throw new Error('The authenticated session could not be persisted.');
  }
  return session;
}

export function readSession(storage: StorageLike): StoredSession | null {
  try {
    const parsed = JSON.parse(storage.getItem(SESSION_KEY) || 'null') as Partial<StoredSession> | null;
    if (!parsed || (parsed.role !== 'author' && parsed.role !== 'user') ||
        typeof parsed.userId !== 'string' || !parsed.userId) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}
