import argon2 from 'argon2';
import fs from 'fs/promises';
import path from 'path';
import { DashboardUser } from './types.js';

const USERS_FILE = process.env.USERS_FILE || '/etc/sd-legal/dashboard-users.json';
let usersCache: DashboardUser[] | null = null;

const INITIAL_USERS = [
  { username: 'eduardo',  displayName: 'Eduardo Dias',     role: 'admin'  as const, envKey: 'DASHBOARD_PASS_EDUARDO'  },
  { username: 'carolina', displayName: 'Carolina Pontes',  role: 'member' as const, envKey: 'DASHBOARD_PASS_CAROLINA' },
  { username: 'ana',      displayName: 'Ana Ferreira',     role: 'member' as const, envKey: 'DASHBOARD_PASS_ANA'      },
  { username: 'mariana',  displayName: 'Mariana Portugal',  role: 'member' as const, envKey: 'DASHBOARD_PASS_MARIANA'  },
  { username: 'silvia',   displayName: 'Silvia Iam',       role: 'member' as const, envKey: 'DASHBOARD_PASS_SILVIA'   },
];

async function saveUsers(users: DashboardUser[]): Promise<void> {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  usersCache = users;
}

async function createInitialUsers(): Promise<DashboardUser[]> {
  return Promise.all(INITIAL_USERS.map(async u => ({
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    passwordHash: await argon2.hash(process.env[u.envKey] || 'sdlegal2026!'),
  })));
}

export async function loadUsers(): Promise<DashboardUser[]> {
  if (usersCache) return usersCache;
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf-8');
    usersCache = JSON.parse(raw);
    return usersCache!;
  } catch {
    const users = await createInitialUsers();
    await saveUsers(users);
    return users;
  }
}

export async function findUser(username: string): Promise<DashboardUser | null> {
  const users = await loadUsers();
  return users.find(u => u.username === username.toLowerCase()) ?? null;
}

export async function verifyPassword(user: DashboardUser, password: string): Promise<boolean> {
  return argon2.verify(user.passwordHash, password);
}

export async function changePassword(username: string, newPassword: string): Promise<void> {
  const users = await loadUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx === -1) throw new Error('User not found');
  users[idx].passwordHash = await argon2.hash(newPassword);
  usersCache = null;
  await saveUsers(users);
}
