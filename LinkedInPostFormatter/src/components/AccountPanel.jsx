import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { useAccount, TRIAL_DAYS } from '../lib/account.js';
import PayPalButton, { PAYPAL_PLAN_ID } from './PayPalButton.jsx';
import GoogleSignInButton from './GoogleSignInButton.jsx';

/**
 * Sign-in, trial status and upgrade.
 *
 * Two ways in: Google, and an email link. Google is offered first because it is
 * one tap, but the email link is kept as a peer rather than a fallback — it works
 * without a Google Cloud OAuth client, so sign-in is never blocked on that setup
 * being finished, and not everyone wants to hand over a Google identity.
 *
 * Renders nothing when Supabase is unconfigured, so the tool keeps working
 * exactly as it does today for anyone who never signs in.
 */
export default function AccountPanel() {
  const { t } = useI18n();
  const { enabled, loading, session, profile, signIn, signOut, remaining, isSubscriber, trialExpired } =
    useAccount();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!enabled || loading) return null;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const { error: err } = await signIn(email.trim());
    if (err) setError(err);
    else setSent(true);
  };

  const box =
    'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5';

  return (
    <section className="max-w-7xl mx-auto px-4 pb-6">
      <div className={box}>
        {!session ? (
          sent ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Check your inbox — the sign-in link is on its way to <strong>{email}</strong>. It
              works once and expires in an hour.
            </p>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Save your work across devices
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                Optional. Everything here works without an account — signing in adds{' '}
                {TRIAL_DAYS}-day access to synced drafts, and lets you pick up a post on your phone
                that you started on a laptop.
              </p>

              <div className="max-w-sm">
                <GoogleSignInButton onError={setError} />
                <div className="flex items-center gap-3 my-3">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {t('gate.or')}
                  </span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>

              <form onSubmit={submit} className="flex gap-2 flex-wrap">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className="flex-1 min-w-[220px] px-3 py-2 text-sm rounded-md border border-slate-300
                             dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-linkedin"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium rounded-md bg-linkedin text-white hover:bg-linkedin-dark transition"
                >
                  {t('gate.emailLink')}
                </button>
              </form>
              {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
            </>
          )
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {session.user.email}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isSubscriber
                    ? profile?.current_period_end
                      ? `Subscribed · renews ${new Date(profile.current_period_end).toLocaleDateString()}`
                      : 'Subscribed'
                    : remaining > 0
                      ? `Free trial · ${remaining} day${remaining === 1 ? '' : 's'} left`
                      : 'Free trial ended'}
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="text-xs text-slate-500 hover:text-red-600 transition"
              >
                Sign out
              </button>
            </div>

            {!isSubscriber && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-3">
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
                  {trialExpired
                    ? 'Your trial has ended. Subscribe to keep synced drafts — the formatter, checks and templates stay free either way.'
                    : 'Subscribe any time to keep synced drafts once the trial ends.'}
                </p>
                {PAYPAL_PLAN_ID ? (
                  <PayPalButton />
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Subscriptions are not switched on for this build yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
