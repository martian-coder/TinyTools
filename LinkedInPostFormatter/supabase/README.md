# Backend setup

Four steps. Nothing here runs until the keys are filled in — the app works
exactly as it does now with all of this left blank.

## 1. Supabase

1. Create a project at supabase.com (free tier is enough to start).
2. SQL Editor → paste `schema.sql` → Run.
3. Settings → API → copy the **Project URL** and **anon public** key into
   `src/lib/supabase.js`.
4. Authentication → Providers → Email → make sure **Magic Link** is on.

That is sign-in working. No Google Cloud project needed.

## 2. PayPal

1. developer.paypal.com → Apps & Credentials → create a REST app → copy the
   **Client ID**.
2. Create a **subscription plan** (Pay → Subscriptions). Note the **Plan ID**.
3. Put both into `src/components/PayPalButton.jsx`.

## 3. The webhook

The webhook is what actually grants access. Without it, a closed browser tab
during checkout means a paying customer with no subscription.

```bash
supabase functions deploy paypal-webhook --no-verify-jwt
supabase secrets set \
  PAYPAL_CLIENT_ID=...   \
  PAYPAL_SECRET=...      \
  PAYPAL_WEBHOOK_ID=...  \
  PAYPAL_API=https://api-m.paypal.com
```

In PayPal, add a webhook pointing at the deployed function URL and subscribe to
`BILLING.SUBSCRIPTION.*` and `PAYMENT.SALE.COMPLETED`.

**Test in sandbox first** (`PAYPAL_API=https://api-m.sandbox.paypal.com`). A
billing bug found in production is found by a customer.

## 4. Check what people use

```sql
select * from public.usage_summary;
```

Which features people actually touch, and how many distinct people touch them.
That is the answer to what is worth charging for — and it is worth waiting for
real numbers before setting the price.

## The thing to know about matching accounts

The webhook matches a PayPal subscription to a profile **by email address**. If
someone pays with a different PayPal email than they signed in with, no profile
matches and the subscription silently does not apply. Either say so at checkout,
or pass the user id through as a `custom_id` on the subscription and match on
that instead — the more robust route if this gets real volume.
