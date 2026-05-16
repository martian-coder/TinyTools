# MarkdownZipped — SaaS

A real, runnable backend for accounts, subscriptions, and an admin
dashboard around the MarkdownZipped studio. Node + Express + built-in
`node:sqlite`. No framework, no native build, five pure-JS deps.

> **Privacy / liability by design.** This server stores **only** account
> and billing state (email, bcrypt password hash, plan). It **never**
> receives prompt text or the user's LLM API key — the compressor runs
> client-side in the studio with the user's own key (BYOK). That removes
> the data-protection exposure. It does **not** remove the obligations
> that come with *taking money*: see "Legal you can't skip" below.

---

## Run it

```bash
cd MarkdownZipped/saas
npm install
cp .env.example .env          # then edit it (see below)
npm start                     # http://localhost:8787
npm test                      # 19-check end-to-end smoke test
```

Generate the two required secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # SECRETS_KEY
```

Set `ADMIN_EMAIL` in `.env` — the first account that signs up with that
email becomes the admin and can reach `/admin`.

---

## What's wired

| Area | Status |
|------|--------|
| Email/password auth | bcrypt (cost 12), JWT in httpOnly+SameSite cookie, rate-limited |
| Roles | `user` / `admin` (admin = `ADMIN_EMAIL`) |
| Plans | Free / Pro / Team / Enterprise — limits enforced **server-side** |
| Saved-prompt library | per-plan caps, server-enforced |
| Stripe | Checkout Session + webhook (HMAC-SHA256 verified) |
| Razorpay (UPI/India) | Order create + webhook (HMAC-SHA256 verified) |
| Manual grant | admin assigns any plan (enterprise/comp/dev) |
| Admin dashboard | metrics, MRR, user search, grant/revoke, audit log |
| Payment keys | AES-256-GCM encrypted at rest, **write-only** from admin UI |
| Security headers | CSP, X-CTO, X-Frame, Referrer-Policy |

Every row above is covered by `npm test` (19 checks: auth, guards, plan
limits, admin, encrypted config, forged-vs-valid webhook signatures).

---

## Going live (the parts only you can do)

1. **Host it.** GitHub Pages cannot run this (it needs a server). Deploy
   to Render / Fly.io / Railway / a VPS. Set all `.env` vars there.
   Persist the `data/` dir (SQLite file) on a volume.
2. **Domain + HTTPS.** Point your domain at the host. Payment providers
   require HTTPS for live webhooks.
3. **Payment accounts.** Create Stripe and/or Razorpay accounts. Put the
   live keys into `/admin` → *Payment configuration* (encrypted at rest;
   never in the repo). Register webhooks:
   - Stripe → `https://YOURDOMAIN/api/webhook/stripe`
     (events: `checkout.session.completed`, `customer.subscription.deleted`)
   - Razorpay → `https://YOURDOMAIN/api/webhook/razorpay`
     (events: `order.paid`, `payment.captured`)
4. **Razorpay checkout widget.** `POST /api/checkout/razorpay` returns an
   order id + key id. Add Razorpay's `checkout.js` widget to `pricing`
   to collect payment; the webhook then activates the plan. (Stripe is
   fully wired end-to-end via the hosted Checkout redirect.)
5. **Scale note.** SQLite is fine into the low thousands of users. Past
   that, move to Postgres (swap `src/db.js` — the DAO is small).

---

## Legal you can't skip (BYOK helps, doesn't erase)

BYOK means you never process customer prompts/keys — that genuinely
removes most data-protection burden. But selling subscriptions still
requires, in India and most places:

- **GST registration & invoicing** once you cross the turnover threshold
  (digital services have low/no threshold in several cases — check with
  a CA before you charge the first rupee).
- **Terms of Service + Refund/Cancellation policy** — Razorpay/Stripe
  onboarding will demand published pages for these.
- **Pricing transparency** and a working cancellation path (the account
  page exposes plan state; cancellation runs through the provider portal).

These are pages + a CA conversation, not code. Don't launch paid without
them.

---

## Recommended subscription model

For a dev tool whose core is open-source and client-side, **freemium
with server-side value** is the only model that holds:

| Tier | Price (ref) | Hook |
|------|-------------|------|
| Free | $0 | Full compressor, BYOK, 5 saved prompts — the funnel |
| Pro | $9/mo · ₹749 | Libraries, history, hosted API |
| Team | $29/mo · ₹2,499 | Seats + shared libraries |
| Enterprise | custom | SSO, invoicing, SLA — sales-assisted |

Edit prices/limits in `src/plans.js` (one object). Don't paywall the
client-side compressor — it can't be enforced and gating it kills the
viral loop. Sell the things a server uniquely provides.

**The bigger lever** (still recommend over a paywalled webpage): a
hosted *compression proxy* — a drop-in API base URL in front of
Anthropic/OpenAI that auto-applies `.mdz` + caching and bills a % of the
spend it saves. It sits in the request path (real moat, real willingness
to pay). The `apiAccess` plan flag is the stub to build that on.

---

## Make it spread (honest playbook)

1. Ship the free studio loudly: one blog post with real before/after
   token numbers + a Show HN, be in the thread for 6h.
2. A VS Code / Cursor extension that shows live token savings — the
   recurring touchpoint that drives signups.
3. AI newsletters (TLDR AI, Ben's Bites). A "Tokenless Score" repo badge.
4. Only then: paid tiers + the proxy. Distribution before monetization.

Viral ≠ revenue — be ready for that. The free tool earns distribution;
the proxy/seats earn money.

---

## File map

```
saas/
├── src/server.js     Express wiring, webhooks (raw body), static, headers
├── src/db.js         node:sqlite schema + encrypted-settings vault
├── src/auth.js       bcrypt + JWT cookie, roles, rate limit
├── src/plans.js      plan catalog + server-enforced limits
├── src/payments.js   Stripe + Razorpay + manual grant, sig verification
├── src/admin.js      admin API (metrics, users, config, audit)
├── public/           landing, pricing, login, signup, account, admin
└── test/smoke.mjs    19-check end-to-end test
```
