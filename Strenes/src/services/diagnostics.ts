/**
 * diagnostics — in-app connection self-test for registration/search issues.
 *
 * Runs the EXACT chain the app uses, against the real backend, and reports
 * pass/fail per step so a failing install pinpoints its own cause:
 *   1. anonymous session        (Supabase → Authentication → anonymous on?)
 *   2. server functions present (migration 006 run?)
 *   3. PIN registration write   (claim_phone_with_pin creates rows?)
 *   4. search read-back         (find_user_by_phone sees the row?)
 *   5. direct users upsert      (client RLS INSERT/UPDATE policies?)
 *   6. contacts insert          (contacts RLS INSERT policy?)
 *
 * Uses one fixed test identity (+910000000001 / PIN 1234) so repeated runs
 * reuse a single harmless row instead of accumulating junk.
 */

import { supabase } from './backends/supabase';

export interface DiagStep {
  name: string;
  ok: boolean;
  detail: string;
}

const TEST_PHONE = '+910000000001';
const TEST_PIN = '1234';

export async function runDiagnostics(): Promise<DiagStep[]> {
  const steps: DiagStep[] = [];
  const push = (name: string, ok: boolean, detail: string) => steps.push({ name, ok, detail });

  // 1 ── anonymous session
  let uid: string | undefined;
  try {
    const { data: existing } = await supabase.auth.getSession();
    uid = existing.session?.user?.id;
    if (!uid) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      uid = data.user?.id;
    }
    if (!uid) throw new Error('no session returned');
    push('1. Backend session', true, `session ok (${uid.slice(0, 8)}…)`);
  } catch (e: any) {
    push('1. Backend session', false,
      `${e.message ?? e} — enable Anonymous sign-ins in Supabase → Authentication → Sign In / Up`);
    return steps; // nothing else can run without a session
  }

  // 2 ── server functions present (migration 006)
  try {
    const { error } = await supabase.rpc('phone_has_pin', { p_phone: TEST_PHONE });
    if (error) throw error;
    push('2. Server functions (migration 006)', true, 'phone_has_pin responded');
  } catch (e: any) {
    push('2. Server functions (migration 006)', false,
      `${e.message ?? e} — run 006_pin_auth_consolidated.sql in Supabase → SQL Editor`);
  }

  // 3 ── PIN registration write (the exact call sign-up makes)
  try {
    const { data, error } = await supabase.rpc('claim_phone_with_pin', {
      p_phone: TEST_PHONE, p_pin: TEST_PIN,
    });
    if (error) throw error;
    push('3. Registration write', true, `claim_phone_with_pin → ${data}`);
  } catch (e: any) {
    push('3. Registration write', false, String(e.message ?? e));
  }

  // 4 ── search read-back (row visible the way Contacts search reads it)
  try {
    const { data, error } = await supabase.rpc('find_user_by_phone', { p_phone: TEST_PHONE });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('registered row NOT found — users insert is failing server-side');
    push('4. Search read-back', true, `found ${row.phone}`);
  } catch (e: any) {
    push('4. Search read-back', false, String(e.message ?? e));
  }

  // 5 ── direct users upsert (client-side RLS path used by profile save)
  try {
    const { error } = await supabase.from('users').upsert({
      id: uid, phone: TEST_PHONE, display_name: 'diag-test',
      created_at: Date.now(), last_seen: Date.now(), online: true,
    });
    if (error) throw error;
    push('5. Direct users upsert (RLS)', true, 'client can write its own users row');
  } catch (e: any) {
    push('5. Direct users upsert (RLS)', false,
      `${e.message ?? e} — users INSERT/UPDATE policies from SUPABASE_SETUP.md §2 missing?`);
  }

  // 6 ── contacts insert (then best-effort cleanup)
  try {
    const { error } = await supabase.from('contacts').insert({
      user_id: uid, contact_user_id: uid, contact_phone: TEST_PHONE, added_at: Date.now(),
    });
    if (error && error.code !== '23505') throw error; // duplicate from a prior run is fine
    push('6. Contacts insert (RLS)', true, 'client can write a contact row');
    await supabase.from('contacts').delete()
      .eq('user_id', uid).eq('contact_user_id', uid); // best-effort tidy-up
  } catch (e: any) {
    push('6. Contacts insert (RLS)', false,
      `${e.message ?? e} — contacts INSERT policy missing?`);
  }

  return steps;
}
