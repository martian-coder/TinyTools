import React, { useState } from 'react';

/**
 * Opt-in email capture.
 *
 * Deliberately posts to a hosted form service rather than a backend of our own:
 * the whole app is static files, and standing up a server just to store an email
 * address would be the most expensive way to collect one.
 *
 * Set ENDPOINT to your form URL (Formspree, Buttondown, ConvertKit — any of them
 * accept a plain POST). Until it is set, this renders nothing at all, so an
 * unconfigured build never shows a form that silently drops what people type.
 */
const ENDPOINT = '';

export default function EmailCapture() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error

  if (!ENDPOINT) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 pb-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5">
        {state === 'done' ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Thanks — you're on the list. You'll hear from us when there's something worth reading,
            and not otherwise.
          </p>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Hear when something changes
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
              Occasional notes on new templates and features. Your email is the only thing this
              tool ever sends anywhere — everything you write stays in your browser. Unsubscribe in
              one click.
            </p>
            <form onSubmit={submit} className="flex gap-2 flex-wrap">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="flex-1 min-w-[220px] px-3 py-2 text-sm rounded-md border border-slate-300
                           dark:border-slate-600 bg-white dark:bg-slate-900 outline-none
                           focus:border-linkedin"
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="px-4 py-2 text-sm font-medium rounded-md bg-linkedin text-white
                           hover:bg-linkedin-dark transition disabled:opacity-50"
              >
                {state === 'sending' ? 'Sending…' : 'Keep me posted'}
              </button>
            </form>
            {state === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                That didn't go through. Try again in a moment.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
