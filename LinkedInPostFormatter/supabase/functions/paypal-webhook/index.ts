// PayPal subscription webhook.
//
// Deploy:  supabase functions deploy paypal-webhook --no-verify-jwt
// Secrets: supabase secrets set PAYPAL_CLIENT_ID=... PAYPAL_SECRET=... \
//            PAYPAL_WEBHOOK_ID=... PAYPAL_API=https://api-m.paypal.com
//          (use api-m.sandbox.paypal.com while testing)
//
// This is the only place a subscription becomes active. The browser callback in
// PayPalButton is a convenience: a user can close the tab mid-redirect, and a
// determined one can call it directly. PayPal telling the server is the only
// account of events worth trusting — which is why the billing columns are locked
// to the service role in schema.sql.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPAL_API = Deno.env.get('PAYPAL_API') ?? 'https://api-m.paypal.com';

async function paypalToken(): Promise<string> {
  const auth = btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET')}`);
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json();
  return json.access_token;
}

/**
 * Verifies the notification actually came from PayPal. Without this the endpoint
 * is public and anyone who finds the URL can grant themselves a subscription.
 */
async function verify(req: Request, body: string, token: string): Promise<boolean> {
  const res = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: req.headers.get('paypal-auth-algo'),
      cert_url: req.headers.get('paypal-cert-url'),
      transmission_id: req.headers.get('paypal-transmission-id'),
      transmission_sig: req.headers.get('paypal-transmission-sig'),
      transmission_time: req.headers.get('paypal-transmission-time'),
      webhook_id: Deno.env.get('PAYPAL_WEBHOOK_ID'),
      webhook_event: JSON.parse(body),
    }),
  });
  const json = await res.json();
  return json.verification_status === 'SUCCESS';
}

// Service-role client: the whole point is writing columns the user cannot.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const ACTIVATING = new Set([
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED',
  'PAYMENT.SALE.COMPLETED',
]);
const ENDING = new Set([
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
]);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = await req.text();
  const token = await paypalToken();
  if (!(await verify(req, body, token))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);
  const subscriptionId = event.resource?.id ?? event.resource?.billing_agreement_id;
  // The subscriber's email is how a PayPal account is matched to a profile, so
  // the PayPal email must be the one they signed in with.
  const email =
    event.resource?.subscriber?.email_address ?? event.resource?.payer?.payer_info?.email;

  if (!email) return new Response('No subscriber email', { status: 202 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    // 202 rather than an error: PayPal retries on failure, and retrying will not
    // conjure an account that was never created.
    return new Response('No matching profile', { status: 202 });
  }

  if (ACTIVATING.has(event.event_type)) {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await supabase
      .from('profiles')
      .update({
        plan: 'active',
        paypal_subscription_id: subscriptionId,
        current_period_end: periodEnd.toISOString(),
      })
      .eq('id', profile.id);
  } else if (ENDING.has(event.event_type)) {
    await supabase.from('profiles').update({ plan: 'expired' }).eq('id', profile.id);
  }

  return new Response('ok', { status: 200 });
});
