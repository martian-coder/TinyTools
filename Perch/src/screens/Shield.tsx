/**
 * Shield — the live test bench. Paste (or pick) any message and watch the
 * exact same engine the Android watcher runs decide in real time. On a
 * linked kid phone, hits are also relayed to the parent — so families can
 * verify the whole pipeline end-to-end in ten seconds.
 */

import { useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { detectThreat, CATEGORY_LABELS, type DetectionHit } from '../detection/engine';
import { usePerch, uid } from '../store';
import { pushEvent } from '../lib/relay';
import type { PerchEvent } from '../types';
import { Btn, Glass, SectionTitle } from '../components/ui';

const SAMPLES = [
  "don't tell your mom about this",
  'send me a pic of yourself',
  "i'll buy you robux if you keep this secret",
  'you have won a prize! claim your reward now',
  'nobody likes you at school',
  'mom said dinner at 7',
];

export function Shield() {
  const { role, demo, pairingId, linked } = usePerch();
  const addEvents = usePerch(s => s.addEvents);
  const [text, setText] = useState('');
  const [verdict, setVerdict] = useState<{ text: string; hit: DetectionHit | null } | null>(null);

  function scan(t: string) {
    const input = t.trim();
    if (!input) return;
    const hit = detectThreat(input);
    setVerdict({ text: input, hit });

    if (hit) {
      const e: PerchEvent = {
        id: uid(),
        category: hit.category,
        severity: hit.severity,
        reason: hit.reason,
        app: 'Shield test',
        sender: 'Shield test',
        at: Date.now(),
      };
      // Demo/parent: feed the local nest. Linked kid phone: relay to the parent.
      if (demo || role === 'parent') addEvents([e]);
      if (role === 'kid' && linked && pairingId) void pushEvent(pairingId, e);
    }
  }

  return (
    <div className="scroll-y flex-1 px-4 pb-2">
      <header className="pb-1 pt-5">
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--accent)' }}>Shield test</h1>
        <p className="text-[12px]" style={{ color: 'var(--dim)' }}>
          This is the exact engine that scans notifications on the protected
          phone — try to get something past it.
        </p>
      </header>

      <Glass className="mt-3 p-4">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type or paste any message…"
          rows={3}
          className="w-full resize-none bg-transparent text-[14px] outline-none"
          style={{ color: 'var(--text)' }}
        />
        <Btn className="mt-2 w-full" onClick={() => scan(text)}>Scan it</Btn>
      </Glass>

      {verdict && (
        <Glass className="rise mt-3 p-4">
          {verdict.hit ? (
            <div className="flex items-start gap-3">
              <ShieldAlert size={26} style={{ color: 'var(--danger)' }} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold" style={{ color: 'var(--danger)' }}>
                  Flagged — {CATEGORY_LABELS[verdict.hit.category]}
                  {verdict.hit.severity === 'alert' ? ' · parent alerted instantly' : ' · goes in the digest'}
                </p>
                <p className="mt-1 text-[13px] leading-snug" style={{ color: 'var(--dim)' }}>{verdict.hit.reason}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <ShieldCheck size={26} style={{ color: 'var(--accent2)' }} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold" style={{ color: 'var(--accent2)' }}>Clean</p>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--dim)' }}>
                  Normal traffic passes silently — Perch only speaks up when something's wrong.
                </p>
              </div>
            </div>
          )}
        </Glass>
      )}

      <SectionTitle>Try these</SectionTitle>
      <div className="flex flex-col gap-2 pb-3">
        {SAMPLES.map(s => (
          <button
            key={s}
            onClick={() => { setText(s); scan(s); }}
            className="glass glass-hover rounded-2xl px-4 py-3 text-left text-[13px]"
            style={{ color: 'var(--text)' }}
          >
            “{s}”
          </button>
        ))}
      </div>
    </div>
  );
}
