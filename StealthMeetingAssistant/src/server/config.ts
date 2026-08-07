import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

/**
 * Load .env once, without clobbering real env vars.
 *
 * Several locations are tried because an installed build and a checkout live
 * in very different places: an installed app's directory is read-only, so the
 * file the user edits has to sit beside their data instead.
 */
let loaded = false;
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  for (const candidate of envCandidates()) {
    if (candidate && fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
  }
}

function envCandidates(): (string | undefined)[] {
  return [
    process.env.ASSISTANT_ENV_FILE,
    // Writable per-user location, which is where an installed build looks.
    path.join(dataDir(), '.env'),
    // Beside the executable, for a portable build.
    path.join(path.dirname(process.execPath), '.env'),
    // A plain checkout.
    path.join(projectRoot(), '.env'),
  ];
}

/**
 * Seed a per-user .env from the template on first run, so an installed build
 * gives the user a real file to edit instead of a missing-key error.
 */
export function ensureUserEnvFile(templatePath: string): string | undefined {
  const target = path.join(dataDir(), '.env');
  if (fs.existsSync(target)) return target;
  try {
    if (!fs.existsSync(templatePath)) return undefined;
    fs.copyFileSync(templatePath, target);
    return target;
  } catch {
    return undefined;
  }
}

export function projectRoot(): string {
  // dist/server/config.js -> ../..  |  src/server/config.ts -> ../..
  return path.resolve(__dirname, '..', '..');
}

let resolvedDataDir: string | undefined;

/**
 * Where documents, embeddings, the session token and the user's .env live.
 *
 * In a packaged app the project root is inside a read-only asar archive, so
 * writing there fails. Rather than depend on the caller having set DATA_DIR,
 * fall back to a per-user directory whenever the preferred one is not
 * writable — an unwritable data directory would otherwise take the whole app
 * down at startup.
 */
export function dataDir(): string {
  if (resolvedDataDir) return resolvedDataDir;

  const candidates = [
    process.env.DATA_DIR ? path.resolve(projectRoot(), process.env.DATA_DIR) : undefined,
    path.join(projectRoot(), 'data'),
    path.join(os.homedir(), '.stealth-meeting-assistant'),
    path.join(os.tmpdir(), 'stealth-meeting-assistant'),
  ].filter((d): d is string => Boolean(d));

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      resolvedDataDir = dir;
      return dir;
    } catch {
      // Read-only (inside an asar) or otherwise unusable; try the next one.
    }
  }
  throw new Error('No writable data directory found');
}

/** Tests reset this between runs. */
export function resetDataDir(): void {
  resolvedDataDir = undefined;
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
