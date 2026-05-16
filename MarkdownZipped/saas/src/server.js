import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, now, audit } from "./db.js";
import {
  register, login, setSession, clearSession,
  currentUser, requireAuth, rateLimit,
} from "./auth.js";
import { PLANS, planOf } from "./plans.js";
import {
  stripeCheckout, verifyStripeSig, handleStripeEvent,
  razorpayOrder, verifyRazorpaySig, handleRazorpayEvent,
  providerStatus,
} from "./payments.js";
import { adminRouter } from "./admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1);

// ---- security headers (no extra dep) --------------------------------
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src https://fonts.gstatic.com; " +
      "connect-src 'self' https://api.anthropic.com; img-src 'self' data:"
  );
  next();
});

// Stripe/Razorpay webhooks need the RAW body for signature checks —
// register these BEFORE the json parser.
app.post("/api/webhook/stripe", express.raw({ type: "*/*" }), (req, res) => {
  const raw = req.body.toString("utf8");
  if (!verifyStripeSig(raw, req.headers["stripe-signature"])) {
    return res.status(400).send("bad signature");
  }
  try { handleStripeEvent(JSON.parse(raw)); } catch { /* ignore malformed */ }
  res.json({ received: true });
});

app.post("/api/webhook/razorpay", express.raw({ type: "*/*" }), (req, res) => {
  const raw = req.body.toString("utf8");
  if (!verifyRazorpaySig(raw, req.headers["x-razorpay-signature"])) {
    return res.status(400).send("bad signature");
  }
  try { handleRazorpayEvent(JSON.parse(raw)); } catch { /* ignore malformed */ }
  res.json({ received: true });
});

app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

// ---- auth -----------------------------------------------------------
app.post("/api/auth/signup", rateLimit, (req, res) => {
  try {
    const u = register(req.body?.email, req.body?.password, req.ip);
    setSession(res, u);
    res.json({ ok: true, user: publicUser(u) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/auth/login", rateLimit, (req, res) => {
  try {
    const u = login(req.body?.email, req.body?.password, req.ip);
    setSession(res, u);
    res.json({ ok: true, user: publicUser(u) });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const u = currentUser(req);
  res.json({ user: u ? publicUser(u) : null, plans: PLANS });
});

function publicUser(u) {
  const p = planOf(u);
  return {
    id: u.id, email: u.email, role: u.role,
    plan: u.plan, planName: p.name, plan_status: u.plan_status,
    plan_until: u.plan_until, limits: p,
  };
}

// ---- saved prompts (paid value, server-enforced limit) --------------
app.get("/api/prompts", requireAuth, (req, res) => {
  res.json(
    db.prepare(
      "SELECT id,name,length(body) size,created_at FROM saved_prompts WHERE user_id=? ORDER BY id DESC"
    ).all(req.user.id)
  );
});

app.get("/api/prompts/:id", requireAuth, (req, res) => {
  const row = db
    .prepare("SELECT * FROM saved_prompts WHERE id=? AND user_id=?")
    .get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

app.post("/api/prompts", requireAuth, (req, res) => {
  const limit = planOf(req.user).savedPrompts;
  const count = db
    .prepare("SELECT COUNT(*) c FROM saved_prompts WHERE user_id=?")
    .get(req.user.id).c;
  if (count >= limit) {
    return res
      .status(402)
      .json({ error: `Plan limit reached (${limit}). Upgrade for more.` });
  }
  const name = String(req.body?.name || "untitled").slice(0, 120);
  const body = String(req.body?.body || "");
  if (body.length > 200000) return res.status(413).json({ error: "Too large." });
  const info = db
    .prepare(
      "INSERT INTO saved_prompts(user_id,name,body,created_at) VALUES(?,?,?,?)"
    )
    .run(req.user.id, name, body, now());
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.delete("/api/prompts/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM saved_prompts WHERE id=? AND user_id=?").run(
    Number(req.params.id), req.user.id
  );
  res.json({ ok: true });
});

// ---- checkout -------------------------------------------------------
app.post("/api/checkout/stripe", requireAuth, async (req, res) => {
  try {
    const url = await stripeCheckout(req.user, String(req.body?.plan || "pro"));
    res.json({ url });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/checkout/razorpay", requireAuth, async (req, res) => {
  try {
    res.json(await razorpayOrder(req.user, String(req.body?.plan || "pro")));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/providers", (req, res) => res.json(providerStatus()));

// ---- admin ----------------------------------------------------------
app.use("/api/admin", adminRouter);

// ---- static frontend ------------------------------------------------
const PUB = path.join(__dirname, "..", "public");
// The free client-side compressor (the funnel) is served as-is.
app.use("/studio", express.static(path.join(__dirname, "..", "..", "web"), {
  extensions: ["html"],
}));
app.use(express.static(PUB, { extensions: ["html"] }));
app.get("/healthz", (req, res) => res.json({ ok: true, ts: now() }));
app.get("*", (req, res) => res.sendFile(path.join(PUB, "index.html")));

const PORT = Number(process.env.PORT || 8787);
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`MarkdownZipped SaaS on http://localhost:${PORT}`);
    if ((process.env.JWT_SECRET || "").length < 24)
      console.warn("WARNING: weak/missing JWT_SECRET — see .env.example");
  });
}

export { app };
