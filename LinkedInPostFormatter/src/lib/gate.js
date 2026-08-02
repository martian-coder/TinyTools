/**
 * Tracks how long someone has been using the tool anonymously.
 *
 * An anonymous visitor has no server record by definition, so first-use has to
 * live in localStorage — which means clearing storage or opening a private
 * window resets it. That is inherent, not an oversight: this is a prompt to sign
 * in, not a lock. It is set the first time the app loads so the clock starts on
 * arrival rather than on whenever it is first read.
 */
const FIRST_USE_KEY = 'lpf.firstUse';

export const GATE_AFTER_DAYS = 2;

export function firstUseAt() {
  const stored = localStorage.getItem(FIRST_USE_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const now = Date.now();
  localStorage.setItem(FIRST_USE_KEY, String(now));
  return now;
}

export function daysUsed() {
  return (Date.now() - firstUseAt()) / 86_400_000;
}

/**
 * Whether to ask for sign-in.
 *
 * Requires Supabase to be configured. Without it there is no way to sign in, so
 * showing the gate would lock every user out of a tool that has no door.
 */
export function shouldGate({ enabled, session }) {
  if (!enabled) return false;
  if (session) return false;
  return daysUsed() >= GATE_AFTER_DAYS;
}
