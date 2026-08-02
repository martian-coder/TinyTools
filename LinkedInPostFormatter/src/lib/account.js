import { useCallback, useEffect, useState } from 'react';
import { getSupabase, isConfigured } from './supabase.js';

export const TRIAL_DAYS = 14;

/**
 * Account state: session, plan, and how much trial is left.
 *
 * Trial remaining is computed from the server's trial_started_at, never from
 * anything the browser stores. A countdown kept in localStorage resets on a
 * cleared cache or an incognito window, which makes the trial unlimited by
 * accident.
 */
export function daysLeft(profile) {
  if (!profile?.trial_started_at) return TRIAL_DAYS;
  const started = new Date(profile.trial_started_at).getTime();
  const elapsed = (Date.now() - started) / 86_400_000;
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
}

export function useAccount() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isConfigured());

  useEffect(() => {
    if (!isConfigured()) return undefined;
    let active = true;
    let subscription = null;

    getSupabase().then((sb) => {
      if (!sb || !active) return;
      sb.auth.getSession().then(({ data }) => {
        if (active) {
          setSession(data.session ?? null);
          setLoading(false);
        }
      });
      const { data } = sb.auth.onAuthStateChange((_event, next) => {
        if (active) setSession(next);
      });
      subscription = data?.subscription ?? null;
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    getSupabase().then(async (sb) => {
      if (!sb) return;
      const { data } = await sb
        .from('profiles')
        .select('trial_started_at, plan, current_period_end')
        .eq('id', session.user.id)
        .single();
      setProfile(data ?? null);
    });
  }, [session]);

  const signIn = useCallback(async (email) => {
    const sb = await getSupabase();
    if (!sb) return { error: 'Accounts are not configured for this build.' };
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const sb = await getSupabase();
    if (!sb) return { error: 'Accounts are not configured for this build.' };
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const sb = await getSupabase();
    await sb?.auth.signOut();
  }, []);

  const remaining = daysLeft(profile);
  const isSubscriber = profile?.plan === 'active';

  return {
    enabled: isConfigured(),
    loading,
    session,
    profile,
    signIn,
    signInWithGoogle,
    signOut,
    remaining,
    isSubscriber,
    // Access is a display concern here, not a lock — see the note in AccountPanel.
    trialExpired: Boolean(profile) && !isSubscriber && remaining <= 0,
  };
}

/**
 * Records what gets used. Never records post content — the tool's promise is
 * that what you write stays on your device, and logging drafts would break it.
 * Fire-and-forget: analytics must never interrupt someone mid-sentence.
 */
export async function trackUsage(userId, event, detail = null) {
  if (!isConfigured() || !userId) return;
  try {
    const sb = await getSupabase();
    await sb?.from('usage_events').insert({ user_id: userId, event, detail });
  } catch {
    /* ignore */
  }
}
