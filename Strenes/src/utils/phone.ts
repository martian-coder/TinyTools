/**
 * Phone number helpers. Everything the app sends to a backend or stores in the
 * users table goes through normalizePhone() so "+1 (555) 123-4567" and
 * "+15551234567" always resolve to the same account.
 */

/** Collapse a user-typed phone number to E.164-ish form: "+" plus digits only. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

/** True when the normalized number looks like a plausible E.164 number. */
export function isValidPhone(input: string): boolean {
  const n = normalizePhone(input);
  // E.164: max 15 digits; require at least 8 so short codes don't pass.
  return /^\+[0-9]{8,15}$/.test(n);
}

/**
 * Looser gate for CONTACT SEARCH: a bare local number (no country code) is
 * enough to look someone up, because search matches on the trailing 10
 * digits server-side. Requires 7+ digits so a stray keystroke doesn't fire.
 */
export function isSearchableNumber(input: string): boolean {
  return input.replace(/[^0-9]/g, '').length >= 7;
}
