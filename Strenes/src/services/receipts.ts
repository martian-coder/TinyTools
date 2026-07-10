/**
 * receipts — honest delivery/read status between two Strenes users.
 *
 * Principles (recipient-first, like everything here):
 * - The sender sees a READ tick only when the recipient actually viewed the
 *   message — never on mere delivery.
 * - When the recipient's filter holds or drops a message, the sender gets a
 *   short reason ("held — spam") — status, not the recipient's rule details.
 *
 * Receipts ride the same relay as chat messages and call signals, as JSON
 * envelopes intercepted in App.tsx before moderation.
 */

import { sendMessage as relaySend } from './backend';

const RECEIPT_TAG = '__strenes_receipt';

/**
 * Prefix for the automatic "can't receive this" notice sent back to a sender
 * whose message was blocked. Doubles as the loop guard: an incoming message
 * carrying this prefix is never auto-replied to.
 */
export const AUTO_NOTICE_PREFIX = '🛡️ Auto-reply:';

export function isAutoNotice(text: string): boolean {
  return text.startsWith(AUTO_NOTICE_PREFIX);
}

/** Fire-and-forget notice to the sender that their message can't be received. */
export function sendAutoNotice(myId: string, to: string): void {
  relaySend(myId, to, `${AUTO_NOTICE_PREFIX} I can't receive this kind of message right now.`)
    .catch(err => console.error('Auto-notice send failed:', err));
}

export type ReceiptKind = 'delivered' | 'read' | 'held' | 'filtered';

export interface Receipt {
  kind: ReceiptKind;
  /** Relay ids of the messages this receipt covers. */
  ids: string[];
  /** Short category for held/filtered — e.g. "spam", "review". Never rule details. */
  reason?: string;
}

export function looksLikeReceipt(text: string): boolean {
  return text.startsWith('{') && text.includes(`"${RECEIPT_TAG}"`);
}

export function parseReceipt(text: string): Receipt | null {
  if (!looksLikeReceipt(text)) return null;
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const r = obj[RECEIPT_TAG] as Receipt | undefined;
    if (!r || typeof r.kind !== 'string' || !Array.isArray(r.ids)) return null;
    return { kind: r.kind, ids: r.ids.filter(i => typeof i === 'string'), reason: typeof r.reason === 'string' ? r.reason.slice(0, 40) : undefined };
  } catch {
    return null;
  }
}

/** Fire-and-forget — receipt loss only degrades ticks, never messages. */
export function sendReceipt(myId: string, to: string, receipt: Receipt): void {
  if (!receipt.ids.length) return;
  relaySend(myId, to, JSON.stringify({ [RECEIPT_TAG]: receipt })).catch(err =>
    console.error('Receipt send failed:', err));
}
