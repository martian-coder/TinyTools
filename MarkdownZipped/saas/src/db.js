// SQLite persistence via the built-in node:sqlite (no native build).
// Stores ONLY account + billing state. It never stores user prompts or
// their LLM API key — those stay client-side (BYOK).
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DB_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(
  process.env.DB_PATH || path.join(DATA_DIR, "mdzipped.db")
);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    pw_hash       TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',     -- 'user' | 'admin'
    plan          TEXT NOT NULL DEFAULT 'free',     -- free|pro|team|enterprise
    plan_status   TEXT NOT NULL DEFAULT 'active',   -- active|past_due|canceled
    plan_until    INTEGER,                          -- epoch seconds, NULL = no expiry
    provider      TEXT,                             -- stripe|razorpay|manual
    provider_ref  TEXT,                             -- subscription/customer id
    created_at    INTEGER NOT NULL,
    last_login    INTEGER
  );

  CREATE TABLE IF NOT EXISTS saved_prompts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    provider    TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency    TEXT NOT NULL,
    plan        TEXT NOT NULL,
    status      TEXT NOT NULL,
    ext_id      TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER,
    action     TEXT NOT NULL,
    detail     TEXT,
    ip         TEXT,
    created_at INTEGER NOT NULL
  );
`);

export const now = () => Math.floor(Date.now() / 1000);

// ---- encrypted settings (payment provider secrets at rest) ----------
function secretsKey() {
  const k = process.env.SECRETS_KEY || "";
  const buf = Buffer.from(k, "base64url");
  if (buf.length !== 32) {
    throw new Error("SECRETS_KEY must be 32 bytes (base64url). See .env.example.");
  }
  return buf;
}

export function setSecret(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretsKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, tag, enc]).toString("base64");
  db.prepare(
    `INSERT INTO settings(key,value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  ).run("secret:" + key, blob);
}

export function getSecret(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get("secret:" + key);
  if (!row) return process.env[key.toUpperCase()] || "";
  const raw = Buffer.from(row.value, "base64");
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), enc = raw.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", secretsKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export function hasSecret(key) {
  const row = db.prepare("SELECT 1 FROM settings WHERE key=?").get("secret:" + key);
  return !!row || !!(process.env[key.toUpperCase()]);
}

// ---- plain settings -------------------------------------------------
export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings(key,value) VALUES(?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  ).run(key, JSON.stringify(value));
}
export function getSetting(key, fallback = null) {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row ? JSON.parse(row.value) : fallback;
}

export function audit(userId, action, detail, ip) {
  db.prepare(
    "INSERT INTO audit_log(user_id,action,detail,ip,created_at) VALUES(?,?,?,?,?)"
  ).run(userId ?? null, action, detail ? JSON.stringify(detail) : null, ip ?? null, now());
}
