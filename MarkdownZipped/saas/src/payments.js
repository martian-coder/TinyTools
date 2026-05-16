// Payment integrations. Implemented with fetch + node:crypto so there is
// no heavy SDK and webhook signatures are verified properly.
//
//  - Stripe   : Checkout Session (subscription) + webhook (HMAC-SHA256
//               over "timestamp.payload" with the signing secret).
//  - Razorpay : Order (UPI/cards, India) + webhook (HMAC-SHA256 over
//               the raw body with the webhook secret).
//  - manual   : admin grants a plan directly (enterprise / dev / comp).
//
// Provider keys are read from encrypted settings (set in the admin page)
// or env. They are NEVER returned to the browser.
import crypto from "node:crypto";
import { db, now, getSecret, hasSecret, audit } from "./db.js";
import { PLANS } from "./plans.js";

export function providerStatus() {
  return {
    stripe: hasSecret("stripe_secret_key") && hasSecret("stripe_webhook_secret"),
    razorpay: hasSecret("razorpay_key_id") && hasSecret("razorpay_key_secret"),
  };
}

function setUserPlan(userId, plan, { provider, ref, days = 30, status = "active" }) {
  const until = days ? now() + days * 86400 : null;
  db.prepare(
    `UPDATE users SET plan=?, plan_status=?, plan_until=?, provider=?, provider_ref=?
     WHERE id=?`
  ).run(plan, status, until, provider, ref || null, userId);
}

function recordPayment(userId, provider, amountCents, currency, plan, status, extId) {
  db.prepare(
    `INSERT INTO payments(user_id,provider,amount_cents,currency,plan,status,ext_id,created_at)
     VALUES(?,?,?,?,?,?,?,?)`
  ).run(userId ?? null, provider, amountCents, currency, plan, status, extId || null, now());
}

// ---- Stripe ---------------------------------------------------------
export async function stripeCheckout(user, planId) {
  const plan = PLANS[planId];
  if (!plan || !plan.priceUsd) throw new Error("Plan not purchasable online.");
  const key = getSecret("stripe_secret_key");
  if (!key) throw new Error("Stripe is not configured.");
  const base = process.env.PUBLIC_URL || "http://localhost:8787";

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", `${base}/account?paid=1`);
  form.set("cancel_url", `${base}/pricing?canceled=1`);
  form.set("client_reference_id", String(user.id));
  form.set("customer_email", user.email);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][recurring][interval]", "month");
  form.set("line_items[0][price_data][unit_amount]", String(plan.priceUsd * 100));
  form.set("line_items[0][price_data][product_data][name]", `MarkdownZipped ${plan.name}`);
  form.set("metadata[plan]", planId);
  form.set("metadata[uid]", String(user.id));

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Stripe error");
  return j.url;
}

export function verifyStripeSig(rawBody, sigHeader) {
  const secret = getSecret("stripe_webhook_secret");
  if (!secret || !sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim()))
  );
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`, "utf8")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function handleStripeEvent(evt) {
  if (evt.type === "checkout.session.completed") {
    const s = evt.data.object;
    const uid = Number(s.metadata?.uid || s.client_reference_id);
    const plan = s.metadata?.plan || "pro";
    if (uid) {
      setUserPlan(uid, plan, { provider: "stripe", ref: s.subscription || s.id });
      recordPayment(uid, "stripe", s.amount_total ?? 0, (s.currency || "usd").toUpperCase(), plan, "paid", s.id);
      audit(uid, "subscription_active", { provider: "stripe", plan });
    }
  } else if (evt.type === "customer.subscription.deleted") {
    const sub = evt.data.object;
    const row = db.prepare("SELECT id FROM users WHERE provider_ref=?").get(sub.id);
    if (row) {
      db.prepare("UPDATE users SET plan='free', plan_status='canceled' WHERE id=?").run(row.id);
      audit(row.id, "subscription_canceled", { provider: "stripe" });
    }
  }
}

// ---- Razorpay (UPI / India) ----------------------------------------
export async function razorpayOrder(user, planId) {
  const plan = PLANS[planId];
  if (!plan || !plan.priceInr) throw new Error("Plan not purchasable online.");
  const id = getSecret("razorpay_key_id");
  const secret = getSecret("razorpay_key_secret");
  if (!id || !secret) throw new Error("Razorpay is not configured.");

  const r = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: plan.priceInr * 100,
      currency: "INR",
      notes: { uid: String(user.id), plan: planId },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.description || "Razorpay error");
  return { orderId: j.id, keyId: id, amount: j.amount, plan: planId };
}

export function verifyRazorpaySig(rawBody, sigHeader) {
  const secret = getSecret("razorpay_webhook_secret") || getSecret("razorpay_key_secret");
  if (!secret || !sigHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function handleRazorpayEvent(evt) {
  if (evt.event === "order.paid" || evt.event === "payment.captured") {
    const entity = evt.payload?.payment?.entity || evt.payload?.order?.entity || {};
    const notes = entity.notes || evt.payload?.order?.entity?.notes || {};
    const uid = Number(notes.uid);
    const plan = notes.plan || "pro";
    if (uid) {
      setUserPlan(uid, plan, { provider: "razorpay", ref: entity.order_id || entity.id });
      recordPayment(uid, "razorpay", entity.amount ?? 0, "INR", plan, "paid", entity.id);
      audit(uid, "subscription_active", { provider: "razorpay", plan });
    }
  }
}

// ---- manual grant (admin) ------------------------------------------
export function grantPlan(adminId, userId, planId, days) {
  if (!PLANS[planId]) throw new Error("Unknown plan.");
  setUserPlan(userId, planId, {
    provider: "manual",
    ref: `admin:${adminId}`,
    days: days ?? (planId === "enterprise" ? 365 : 30),
  });
  audit(adminId, "grant_plan", { userId, planId, days });
}
