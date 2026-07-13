/**
 * analyst — Perch's parent-facing intelligence. Answers natural questions
 * ("anything I should worry about this week?") grounded ONLY in the flag
 * event log. Chain: pasted cloud key → managed proxy → on-device Gemini
 * Nano → deterministic analyst (always works, offline, no AI at all).
 */

import type { PerchEvent } from '../types';
import { CATEGORY_LABELS } from '../detection/engine';
import { promptCloud } from './cloud';
import { promptNano } from './nano';

const DAY = 24 * 3600_000;

function when(at: number): string {
  const diff = Date.now() - at;
  if (diff < 3600_000) return `${Math.max(1, Math.round(diff / 60000))} min ago`;
  if (diff < DAY) return `${Math.round(diff / 3600_000)}h ago`;
  const d = new Date(at);
  const days = Math.round(diff / DAY);
  if (days <= 7) return `${days} day${days > 1 ? 's' : ''} ago (${d.toLocaleDateString(undefined, { weekday: 'short' })})`;
  return d.toLocaleDateString();
}

/** Compact, prompt-friendly view of the log. Newest first. */
export function eventLogText(events: PerchEvent[], kidAlias: string): string {
  if (!events.length) return `No flags at all so far on ${kidAlias || 'the protected phone'}.`;
  const lines = events.slice(0, 60).map(e =>
    `- [${when(e.at)}] ${e.severity.toUpperCase()} · ${CATEGORY_LABELS[e.category]} · from "${e.sender}" on ${e.app} — ${e.reason}`,
  );
  return lines.join('\n');
}

/** Deterministic briefing — used as digest text and as the no-AI fallback. */
export function briefing(events: PerchEvent[], kidAlias: string, sinceMs = 7 * DAY): string {
  const name = kidAlias || 'the protected phone';
  const recent = events.filter(e => Date.now() - e.at <= sinceMs);
  if (!recent.length) {
    return `Quiet — nothing flagged on ${name} in the last ${Math.round(sinceMs / DAY)} days. I'm still watching. 🦉`;
  }
  const alerts = recent.filter(e => e.severity === 'alert');
  const watches = recent.filter(e => e.severity === 'watch');
  const parts: string[] = [];
  if (alerts.length) {
    parts.push(`${alerts.length} serious flag${alerts.length > 1 ? 's' : ''}:`);
    for (const a of alerts.slice(0, 5)) {
      parts.push(`• ${CATEGORY_LABELS[a.category]} — "${a.sender}" on ${a.app}, ${when(a.at)}. ${a.reason}.`);
    }
  }
  if (watches.length) {
    const byCat = new Map<string, number>();
    for (const w of watches) byCat.set(CATEGORY_LABELS[w.category], (byCat.get(CATEGORY_LABELS[w.category]) ?? 0) + 1);
    const summary = [...byCat.entries()].map(([c, n]) => `${n}× ${c.toLowerCase()}`).join(', ');
    parts.push(`Also watching: ${summary} — in the daily digest, nothing urgent.`);
  }
  if (!alerts.length) {
    parts.unshift(`Nothing serious on ${name}.`);
  }
  return parts.join('\n');
}

/** Keyword answer for the most common questions — the always-works fallback. */
function deterministicAnswer(question: string, events: PerchEvent[], kidAlias: string): string {
  const q = question.toLowerCase();
  if (/today/.test(q)) return briefing(events, kidAlias, DAY);
  if (/month/.test(q)) return briefing(events, kidAlias, 30 * DAY);
  if (/who|sender|stranger|new/.test(q)) {
    const senders = new Map<string, number>();
    for (const e of events) senders.set(`"${e.sender}" (${e.app})`, (senders.get(`"${e.sender}" (${e.app})`) ?? 0) + 1);
    if (!senders.size) return `No one has triggered a flag on ${kidAlias || 'the protected phone'} yet.`;
    const list = [...senders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([s, n]) => `• ${s} — ${n} flag${n > 1 ? 's' : ''}`).join('\n');
    return `Contacts that triggered flags:\n${list}`;
  }
  return briefing(events, kidAlias);
}

const SYSTEM = (kidAlias: string) => `You are Perch, a calm and reassuring AI guardian owl 🦉 that watches over a child's phone for their parent. You are talking TO THE PARENT.

You will be given the complete flag log (metadata only: category, sender display name, app, time, reason — Perch never reads or stores message content, everything is scanned on the child's device). Answer the parent's question grounded ONLY in that log.

Rules:
- Be warm, brief, and concrete. A worried parent is reading this on a phone.
- Never invent flags, senders, or details not in the log.
- If the log is quiet, say so plainly and reassure — don't manufacture worry.
- For serious flags (grooming, meet-up, photo requests, self-harm), give one practical next step (e.g. "sit with ${kidAlias || 'your kid'} and look at that Snapchat contact together — don't lead with anger, lead with curiosity").
- Remind gently, when relevant, that Perch sees notification text of flagged apps only, on-device, and never uploads message content.
- Plain text only, no markdown headers. 120 words max unless asked for detail.`;

/**
 * Answer one parent question. Never throws; always returns SOMETHING
 * (the deterministic analyst is the floor).
 */
export async function askPerch(
  question: string,
  events: PerchEvent[],
  kidAlias: string,
  apiKey: string,
): Promise<string> {
  const user = `Flag log for ${kidAlias || 'the protected phone'} (newest first):\n${eventLogText(events, kidAlias)}\n\nParent's question: ${question}`;

  const cloud = await promptCloud(SYSTEM(kidAlias), user, apiKey);
  if (cloud?.trim()) return cloud.trim();

  const nano = await promptNano(SYSTEM(kidAlias), user);
  if (nano?.trim()) return nano.trim();

  return deterministicAnswer(question, events, kidAlias);
}
