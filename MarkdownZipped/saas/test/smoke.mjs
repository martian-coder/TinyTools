// End-to-end smoke test. Boots the app on an ephemeral port against a
// throwaway DB and exercises the real HTTP surface.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mdz-"));
process.env.NODE_ENV = "test";
process.env.DB_DIR = tmp;
process.env.DB_PATH = path.join(tmp, "t.db");
process.env.JWT_SECRET = crypto.randomBytes(48).toString("base64url");
process.env.SECRETS_KEY = crypto.randomBytes(32).toString("base64url");
process.env.ADMIN_EMAIL = "admin@test.io";
process.env.PUBLIC_URL = "http://localhost:0";

const { app } = await import("../src/server.js");
const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const base = `http://localhost:${server.address().port}`;

// tiny cookie jar
function jar() {
  let c = "";
  return {
    async f(p, opts = {}) {
      const r = await fetch(base + p, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          ...(c ? { Cookie: c } : {}),
          ...(opts.headers || {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : opts.raw,
        redirect: "manual",
      });
      const sc = r.headers.getSetCookie?.() || [];
      if (sc.length) c = sc.map((x) => x.split(";")[0]).join("; ");
      let j = null;
      try { j = await r.json(); } catch {}
      return { status: r.status, j };
    },
    clear() { c = ""; },
  };
}

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); console.log("  ok -", msg); pass++; };

try {
  const admin = jar();
  const user = jar();
  const anon = jar();

  // signup admin (matches ADMIN_EMAIL -> role admin)
  let r = await admin.f("/api/auth/signup", { method: "POST", body: { email: "admin@test.io", password: "supersecret1" } });
  ok(r.status === 200 && r.j.user.role === "admin", "admin signup gets admin role");

  // duplicate email rejected
  r = await admin.f("/api/auth/signup", { method: "POST", body: { email: "admin@test.io", password: "supersecret1" } });
  ok(r.status === 400, "duplicate email rejected");

  // weak password rejected
  r = await user.f("/api/auth/signup", { method: "POST", body: { email: "u@test.io", password: "short" } });
  ok(r.status === 400, "weak password rejected");

  // normal user signup
  r = await user.f("/api/auth/signup", { method: "POST", body: { email: "u@test.io", password: "password123" } });
  ok(r.status === 200 && r.j.user.role === "user" && r.j.user.plan === "free", "user signup -> free plan");

  // /api/me reflects session
  r = await user.f("/api/me");
  ok(r.j.user && r.j.user.email === "u@test.io", "session works via cookie");

  // anon blocked from protected route
  r = await anon.f("/api/prompts");
  ok(r.status === 401, "unauthed prompt list -> 401");

  // saved-prompt limit enforced (free = 5)
  for (let i = 0; i < 5; i++) {
    r = await user.f("/api/prompts", { method: "POST", body: { name: "p" + i, body: "x" } });
    assert.equal(r.status, 200);
  }
  r = await user.f("/api/prompts", { method: "POST", body: { name: "p6", body: "x" } });
  ok(r.status === 402, "free plan blocked at 6th saved prompt (402)");

  // admin guard
  r = await user.f("/api/admin/metrics");
  ok(r.status === 403, "non-admin blocked from admin API (403)");
  r = await admin.f("/api/admin/metrics");
  ok(r.status === 200 && r.j.users === 2, "admin metrics ok, 2 users");

  // admin grants pro -> limit lifts
  const uid = (await admin.f("/api/admin/users?q=u@test.io")).j[0].id;
  r = await admin.f("/api/admin/grant", { method: "POST", body: { userId: uid, plan: "pro" } });
  ok(r.status === 200, "admin grant pro");
  r = await user.f("/api/me");
  ok(r.j.user.plan === "pro" && r.j.user.limits.savedPrompts === 500, "user upgraded to pro limits");
  r = await user.f("/api/prompts", { method: "POST", body: { name: "p6", body: "x" } });
  ok(r.status === 200, "pro user can now save beyond free cap");

  // payment config write-only + status
  r = await admin.f("/api/admin/payment-config", { method: "POST", body: { stripe_secret_key: "sk_test_x", stripe_webhook_secret: "whsec_test" } });
  ok(r.status === 200 && r.j.updated === 2, "payment config saved (2 fields)");
  r = await admin.f("/api/admin/payment-config");
  ok(r.j.stripe_secret_key === true && r.j.razorpay_key_id === false, "config status is boolean, never the secret");

  // stripe webhook signature: forged rejected, valid accepted
  const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: { metadata: { uid: String(uid), plan: "team" }, id: "cs_1", amount_total: 2900, currency: "usd" } } });
  r = await admin.f("/api/webhook/stripe", { method: "POST", raw: payload, headers: { "stripe-signature": "t=1,v1=deadbeef" } });
  ok(r.status === 400, "forged stripe signature rejected");
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", "whsec_test").update(`${ts}.${payload}`).digest("hex");
  r = await admin.f("/api/webhook/stripe", { method: "POST", raw: payload, headers: { "stripe-signature": `t=${ts},v1=${sig}` } });
  ok(r.status === 200, "valid stripe signature accepted");
  r = await user.f("/api/me");
  ok(r.j.user.plan === "team", "stripe webhook upgraded user to team");

  // logout clears session
  r = await user.f("/api/auth/logout", { method: "POST" });
  await user.f("/api/me").then(x => ok(x.j.user === null, "logout clears session"));

  // health + studio static
  ok((await anon.f("/healthz")).status === 200, "healthz ok");

  console.log(`\nALL ${pass} CHECKS PASSED`);
} catch (e) {
  console.error("\nFAILED:", e.message);
  process.exitCode = 1;
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
