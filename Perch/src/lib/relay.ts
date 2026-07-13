/**
 * relay — pairing + flag-event sync between the protected phone and the
 * parent's phone, via Supabase RPCs (SECURITY DEFINER; see
 * supabase/perch_migration.sql).
 *
 * Privacy model: only PerchEvent metadata crosses the wire — category,
 * reason, app, sender display name, timestamp. Never message content.
 * The pairing id is an unguessable UUID that acts as the capability to
 * read a pairing's events; the human-friendly 6-char code is one-shot
 * and consumed at claim time.
 */

import { supabase, backendConfigured } from './supabase';
import type { PerchEvent, Severity, ThreatCategory } from '../types';

export interface Pairing {
  pairingId: string;
  code: string;
}

/** Parent side: create a pairing and get the code to read out to the kid setup. */
export async function createPairing(kidAlias: string): Promise<Pairing | null> {
  if (!backendConfigured()) return null;
  const { data, error } = await supabase.rpc('perch_create_pairing', { p_kid_alias: kidAlias });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.pairing_id || !row?.code) return null;
  return { pairingId: row.pairing_id as string, code: row.code as string };
}

/** Kid side: claim a code typed in during setup. One-shot — consumes the code. */
export async function claimPairing(code: string): Promise<string | null> {
  if (!backendConfigured()) return null;
  const { data, error } = await supabase.rpc('perch_claim_pairing', {
    p_code: code.trim().toUpperCase(),
  });
  if (error || !data) return null;
  return data as string;
}

/** Kid side (web layer / shield test): push one flag to the paired parent. */
export async function pushEvent(pairingId: string, e: PerchEvent): Promise<boolean> {
  if (!backendConfigured()) return false;
  const { error } = await supabase.from('perch_events').insert({
    id: e.id,
    pairing_id: pairingId,
    category: e.category,
    severity: e.severity,
    reason: e.reason,
    app: e.app,
    sender: e.sender,
    at_ms: e.at,
  });
  return !error;
}

/** Parent side: fetch events newer than sinceMs (0 = everything). */
export async function fetchEvents(pairingId: string, sinceMs: number): Promise<PerchEvent[]> {
  if (!backendConfigured()) return [];
  const { data, error } = await supabase.rpc('perch_fetch_events', {
    p_pairing_id: pairingId,
    p_since_ms: sinceMs,
  });
  if (error || !Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>): PerchEvent => ({
    id: String(r.id),
    category: r.category as ThreatCategory,
    severity: r.severity as Severity,
    reason: String(r.reason ?? ''),
    app: String(r.app ?? ''),
    sender: String(r.sender ?? ''),
    at: Number(r.at_ms ?? 0),
  }));
}

/** Parent side: has the kid's phone claimed the code yet? */
export async function pairingClaimed(pairingId: string): Promise<boolean> {
  if (!backendConfigured()) return false;
  const { data, error } = await supabase.rpc('perch_pairing_claimed', {
    p_pairing_id: pairingId,
  });
  return !error && data === true;
}
