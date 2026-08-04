import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { useAccount } from '../lib/account.js';

/**
 * Google sign-in, shared by the account panel and the two-day prompt.
 *
 * One implementation rather than two: the mark below has to follow Google's
 * branding rules, and a copy that drifts is a copy that stops complying.
 *
 * Requires a Google Cloud OAuth client configured under Supabase →
 * Authentication → Providers → Google. Without it Supabase returns an error,
 * which is surfaced rather than swallowed — a sign-in button that silently does
 * nothing is worse than one that says why.
 */
export default function GoogleSignInButton({ onError, full = true }) {
  const { t } = useI18n();
  const { signInWithGoogle } = useAccount();
  const [busy, setBusy] = useState(false);

  const click = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setBusy(false);
      onError?.(error);
    }
    // On success the browser navigates to Google, so leaving busy set is correct.
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      className={`${full ? 'w-full' : ''} px-4 py-2.5 rounded-md border border-slate-300
                  dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium
                  text-slate-700 dark:text-slate-200 hover:border-linkedin transition
                  disabled:opacity-60 flex items-center justify-center gap-2`}
    >
      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z" />
        <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.7-5.2c-1.9 1.3-4.4 2.2-7.8 2.2-6 0-11-4-12.8-9.4l-7 5.4C7.9 41 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.2 28.3c-.5-1.4-.8-2.8-.8-4.3s.3-3 .8-4.3l-7-5.4C2.8 17.2 2 20.5 2 24s.8 6.8 2.2 9.7l7-5.4z" />
        <path fill="#EA4335" d="M24 10.3c3.3 0 6.2 1.2 8.5 3.3l6-6C34.9 4.2 29.9 2 24 2 15.4 2 7.9 7 4.2 14.3l7 5.4C13 14.3 18 10.3 24 10.3z" />
      </svg>
      {t('gate.google')}
    </button>
  );
}
