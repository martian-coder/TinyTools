import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, now, audit } from "./db.js";

const COOKIE = "mdz_session";
const isProd = () => process.env.NODE_ENV === "production";

function jwtSecret() {
  const s = process.env.JWT_SECRET || "";
  if (s.length < 24) throw new Error("JWT_SECRET missing/too short — see .env.example");
  return s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- naive in-memory rate limiter for auth endpoints ----------------
const hits = new Map(); // ip -> { n, ts }
export function rateLimit(req, res, next) {
  const ip = req.ip || "0";
  const t = now();
  const e = hits.get(ip) || { n: 0, ts: t };
  if (t - e.ts > 60) { e.n = 0; e.ts = t; }
  e.n++;
  hits.set(ip, e);
  if (e.n > 20) return res.status(429).json({ error: "Too many attempts, slow down." });
  next();
}

export function setSession(res, user) {
  const token = jwt.sign(
    { uid: user.id, role: user.role, email: user.email },
    jwtSecret(),
    { expiresIn: "7d" }
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    maxAge: 7 * 24 * 3600 * 1000,
    path: "/",
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: "/" });
}

export function currentUser(req) {
  const tok = req.cookies?.[COOKIE];
  if (!tok) return null;
  try {
    const { uid } = jwt.verify(tok, jwtSecret());
    return db.prepare("SELECT * FROM users WHERE id=?").get(uid) || null;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: "Sign in required." });
  req.user = u;
  next();
}

export function requireAdmin(req, res, next) {
  const u = currentUser(req);
  if (!u || u.role !== "admin") return res.status(403).json({ error: "Admin only." });
  req.user = u;
  next();
}

export function register(email, password, ip) {
  email = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email.");
  if (String(password || "").length < 8) throw new Error("Password must be 8+ characters.");
  const exists = db.prepare("SELECT 1 FROM users WHERE email=?").get(email);
  if (exists) throw new Error("That email is already registered.");

  const role =
    email === String(process.env.ADMIN_EMAIL || "").toLowerCase() ? "admin" : "user";
  const hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare(
      "INSERT INTO users(email,pw_hash,role,created_at) VALUES(?,?,?,?)"
    )
    .run(email, hash, role, now());
  audit(info.lastInsertRowid, "register", { email, role }, ip);
  return db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
}

export function login(email, password, ip) {
  email = String(email || "").trim().toLowerCase();
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  // Constant-ish work whether or not the user exists.
  const ok = u
    ? bcrypt.compareSync(String(password || ""), u.pw_hash)
    : bcrypt.compareSync("x", "$2a$12$" + "x".repeat(53));
  if (!u || !ok) {
    audit(u?.id, "login_fail", { email }, ip);
    throw new Error("Invalid email or password.");
  }
  db.prepare("UPDATE users SET last_login=? WHERE id=?").run(now(), u.id);
  audit(u.id, "login", null, ip);
  return u;
}
