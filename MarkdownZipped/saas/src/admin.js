// Admin API: metrics, user/subscription management, and write-only
// configuration of payment provider keys (stored encrypted at rest;
// never returned to the browser).
import express from "express";
import { db, setSecret, hasSecret, audit } from "./db.js";
import { requireAdmin } from "./auth.js";
import { grantPlan, providerStatus } from "./payments.js";
import { PLANS } from "./plans.js";

export const adminRouter = express.Router();
adminRouter.use(requireAdmin);

adminRouter.get("/metrics", (req, res) => {
  const users = db.prepare("SELECT COUNT(*) c FROM users").get().c;
  const byPlan = db
    .prepare("SELECT plan, COUNT(*) c FROM users GROUP BY plan")
    .all();
  const paid = db
    .prepare("SELECT COUNT(*) c FROM users WHERE plan != 'free' AND plan_status='active'")
    .get().c;
  const revenue = db
    .prepare("SELECT currency, SUM(amount_cents) s FROM payments WHERE status='paid' GROUP BY currency")
    .all();
  const mrr = (() => {
    const rows = db
      .prepare("SELECT plan, COUNT(*) c FROM users WHERE plan_status='active' AND plan!='free' GROUP BY plan")
      .all();
    let usd = 0;
    for (const r of rows) usd += (PLANS[r.plan]?.priceUsd || 0) * r.c;
    return usd;
  })();
  res.json({ users, paid, byPlan, revenue, mrrUsd: mrr, providers: providerStatus() });
});

adminRouter.get("/users", (req, res) => {
  const q = `%${(req.query.q || "").toString().toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT id,email,role,plan,plan_status,plan_until,provider,created_at,last_login
       FROM users WHERE lower(email) LIKE ? ORDER BY id DESC LIMIT 200`
    )
    .all(q);
  res.json(rows);
});

adminRouter.post("/grant", (req, res) => {
  const { userId, plan, days } = req.body || {};
  try {
    grantPlan(req.user.id, Number(userId), String(plan), days ? Number(days) : undefined);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

adminRouter.post("/revoke", (req, res) => {
  const { userId } = req.body || {};
  db.prepare(
    "UPDATE users SET plan='free', plan_status='canceled' WHERE id=?"
  ).run(Number(userId));
  audit(req.user.id, "revoke_plan", { userId });
  res.json({ ok: true });
});

// Write-only payment config. GET reports only whether each key is SET.
adminRouter.get("/payment-config", (req, res) => {
  res.json({
    stripe_secret_key: hasSecret("stripe_secret_key"),
    stripe_webhook_secret: hasSecret("stripe_webhook_secret"),
    razorpay_key_id: hasSecret("razorpay_key_id"),
    razorpay_key_secret: hasSecret("razorpay_key_secret"),
    razorpay_webhook_secret: hasSecret("razorpay_webhook_secret"),
  });
});

adminRouter.post("/payment-config", (req, res) => {
  const allowed = [
    "stripe_secret_key",
    "stripe_webhook_secret",
    "razorpay_key_id",
    "razorpay_key_secret",
    "razorpay_webhook_secret",
  ];
  let n = 0;
  for (const k of allowed) {
    const v = req.body?.[k];
    if (typeof v === "string" && v.trim()) {
      setSecret(k, v.trim());
      n++;
    }
  }
  audit(req.user.id, "payment_config_update", { fields: n });
  res.json({ ok: true, updated: n });
});

adminRouter.get("/audit", (req, res) => {
  res.json(
    db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 200").all()
  );
});
