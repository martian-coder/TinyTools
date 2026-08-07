import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

/** Load .env once, from the project root, without clobbering real env vars. */
let loaded = false;
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  dotenv.config({ path: path.join(projectRoot(), '.env') });
}

export function projectRoot(): string {
  // dist/server/config.js -> ../..  |  src/server/config.ts -> ../..
  return path.resolve(__dirname, '..', '..');
}

export function dataDir(): string {
  const dir = process.env.DATA_DIR
    ? path.resolve(projectRoot(), process.env.DATA_DIR)
    : path.join(projectRoot(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dataPath(...parts: string[]): string {
  const p = path.join(dataDir(), ...parts);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

export function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function port(): number {
  return num('PORT', 5173);
}

/**
 * A token every API call must present (header `x-assistant-token` or
 * `?token=`). The backend only listens on 127.0.0.1, but any process — or any
 * web page you have open — can also reach loopback, so the token is what
 * actually keeps your documents private. Written to disk so a future STT
 * bridge can read it.
 */
export function sessionToken(): string {
  const file = dataPath('session-token.txt');
  if (process.env.ASSISTANT_TOKEN) return process.env.ASSISTANT_TOKEN;
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 16) return existing;
  } catch {
    /* first run */
  }
  const token = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(file, token, { mode: 0o600 });
  return token;
}

export function authEnabled(): boolean {
  return (process.env.ASSISTANT_AUTH ?? 'on').toLowerCase() !== 'off';
}

/** Read a JSON file, returning `fallback` on missing/corrupt data. */
export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/** Write JSON atomically so a crash mid-write cannot corrupt the store. */
export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value), 'utf8');
  fs.renameSync(tmp, file);
}
