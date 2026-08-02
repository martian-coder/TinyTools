import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { useAccount } from '../lib/account.js';
import { shouldGate } from '../lib/gate.js';

/**
 * Prompts for sign-in after a couple of days of anonymous use.
 *
 * Never appears unless Supabase is configured — without it there is no way to
 * sign in, and the gate would lock everyone out of a tool with no door.
 *
 * Deliberately not a hard lock. The whole app is downloaded to the browser, so
 * a blocking overlay is bypassable by anyone who opens devtools; treating it as
 * a wall would be a wall only for honest people. It sits over the editor, and
 * the templates and guidance below stay readable.
 */
export default function SignInGate() {
  const { t } = useI18n();
  const { enabled, loading, session, signIn, signInWithGoogle } = useAccount();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [showEmail, setShowEmail] = useState(false);

  if (loading || !shouldGate({ enabled, session })) return null;

  const submitEmail = async (event) => {
    event.preventDefault();
    setError('');
    const { error: err } = await signIn(email.trim());
    if (err) setError(err);
    else setSent(true);
  };

  const google = async () => {
    setError('');
    const { error: err } = await signInWithGoogle();
    if (err) setError(err);
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center p-4
                 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="false"
      aria-labelledby="gate-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-5">
        {sent ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Check your inbox — the link is on its way to <strong>{email}</strong>.
          </p>
        ) : (
          <>
            <h2
              id="gate-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1"
            >
              {t('gate.title')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              {t('gate.body')}
            </p>

            <button
              type="button"
              onClick={google}
              className="w-full px-4 py-2.5 rounded-md border border-slate-300 dark:border-slate-600
                         bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200
                         hover:border-linkedin transition flex items-center justify-center gap-2"
            >
              <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z" />
                <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.7-5.2c-1.9 1.3-4.4 2.2-7.8 2.2-6 0-11-4-12.8-9.4l-7 5.4C7.9 41 15.4 46 24 46z" />
                <path fill="#FBBC05" d="M11.2 28.3c-.5-1.4-.8-2.8-.8-4.3s.3-3 .8-4.3l-7-5.4C2.8 17.2 2 20.5 2 24s.8 6.8 2.2 9.7l7-5.4z" />
                <path fill="#EA4335" d="M24 10.3c3.3 0 6.2 1.2 8.5 3.3l6-6C34.9 4.2 29.9 2 24 2 15.4 2 7.9 7 4.2 14.3l7 5.4C13 14.3 18 10.3 24 10.3z" />
              </svg>
              {t('gate.google')}
            </button>

            {showEmail ? (
              <form onSubmit={submitEmail} className="mt-3 flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className="flex-1 min-w-0 px-3 py-2 text-sm rounded-md border border-slate-300
                             dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-linkedin"
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-sm font-medium rounded-md bg-linkedin text-white hover:bg-linkedin-dark transition"
                >
                  →
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="w-full mt-3 text-xs text-slate-500 dark:text-slate-400 hover:text-linkedin transition"
              >
                {t('gate.or')}
              </button>
            )}

            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
