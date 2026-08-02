import React, { useEffect, useRef, useState } from 'react';

/**
 * PayPal subscription button.
 *
 * Fill both from the PayPal developer dashboard: the client ID from your REST
 * app, the plan ID from the billing plan you create. Until PAYPAL_PLAN_ID is
 * set, nothing renders.
 *
 * The onApprove callback is a convenience, not the source of truth. A browser
 * can be closed mid-redirect and a determined user can call it directly, so
 * activation is recorded by the webhook in supabase/functions/paypal-webhook —
 * the only place PayPal itself is doing the telling.
 */
export const PAYPAL_CLIENT_ID = '';
export const PAYPAL_PLAN_ID = '';

export default function PayPalButton() {
  const container = useRef(null);
  const [state, setState] = useState('loading'); // loading | ready | approved | error

  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_PLAN_ID) return undefined;
    let cancelled = false;

    const render = () => {
      if (cancelled || !container.current || !window.paypal) return;
      container.current.innerHTML = '';
      window.paypal
        .Buttons({
          style: { layout: 'horizontal', height: 38, label: 'subscribe' },
          createSubscription: (_data, actions) =>
            actions.subscription.create({ plan_id: PAYPAL_PLAN_ID }),
          onApprove: () => setState('approved'),
          onError: () => setState('error'),
        })
        .render(container.current)
        .then(() => !cancelled && setState('ready'))
        .catch(() => !cancelled && setState('error'));
    };

    if (window.paypal) {
      render();
    } else {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
      script.onload = render;
      script.onerror = () => !cancelled && setState('error');
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (!PAYPAL_CLIENT_ID || !PAYPAL_PLAN_ID) return null;

  if (state === 'approved') {
    return (
      <p className="text-sm text-slate-700 dark:text-slate-300">
        Thank you — PayPal has your subscription. It can take a moment to show here while PayPal
        confirms it; refresh if the status has not changed shortly.
      </p>
    );
  }

  return (
    <>
      <div ref={container} />
      {state === 'error' && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
          PayPal could not load. Check your connection and try again.
        </p>
      )}
    </>
  );
}
