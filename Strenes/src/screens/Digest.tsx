import { useEffect, useRef, useState, useMemo } from 'react';
import { Sparkles, ChevronRight, MessageSquare } from 'lucide-react';
import { useSiftStore } from '../store';
import { Avatar } from '../components/ui/Avatar';
import { CategoryBadge } from '../components/ui/Badge';
import { summarizeMessage } from '../moderation/summarize';
import type { Message, Contact } from '../types';

export function Digest() {
  const allMessages      = useSiftStore(s => s.messages);
  const contacts         = useSiftStore(s => s.contacts);
  const openConversation = useSiftStore(s => s.openConversation);

  // summaries: messageId → summary string (in-memory only, regenerated on mount)
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading,   setLoading]   = useState<Set<string>>(new Set());
  const fetchingRef = useRef<Set<string>>(new Set());

  // One "representative" entry per sender — the most recent delivered in-message
  const threads = useMemo(() => {
    const inMessages = allMessages.filter(
      m => m.dir === 'in' && (m.status === 'delivered' || m.status === 'approved')
    );

    const byContact = new Map<string, Message[]>();
    for (const m of inMessages) {
      const arr = byContact.get(m.contactId) ?? [];
      arr.push(m);
      byContact.set(m.contactId, arr);
    }

    const cById = (id: string): Contact | undefined => contacts.find(c => c.id === id);

    return [...byContact.entries()]
      .map(([contactId, msgs]) => {
        const sorted = [...msgs].sort((a, b) => b.ts - a.ts);
        const latest = sorted[0];
        return { contactId, latest, count: msgs.length, contact: cById(contactId) };
      })
      .sort((a, b) => b.latest.ts - a.latest.ts);
  }, [allMessages, contacts]);

  // Fetch summaries for messages we haven't summarised yet
  useEffect(() => {
    for (const { latest, contact } of threads) {
      const id = latest.id;
      if (summaries[id] || fetchingRef.current.has(id)) continue;

      fetchingRef.current.add(id);
      setLoading(prev => new Set(prev).add(id));

      summarizeMessage(latest.text, contact?.name ?? 'Unknown').then(summary => {
        setSummaries(prev => ({ ...prev, [id]: summary }));
        setLoading(prev => { const s = new Set(prev); s.delete(id); return s; });
        fetchingRef.current.delete(id);
      });
    }
  }, [threads]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <DigestHeader />
      <div className="flex-1 overflow-y-auto px-3 pb-28 no-bar">
        {threads.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2 pt-1">
            {threads.map(({ contactId, latest, count, contact }, i) => {
              const summary   = summaries[latest.id];
              const isLoading = loading.has(latest.id);
              return (
                <DigestCard
                  key={contactId}
                  contact={contact}
                  latest={latest}
                  count={count}
                  summary={summary}
                  isLoading={isLoading}
                  index={i}
                  onOpen={() => openConversation(contactId)}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Card ──────────────────────────────────────────────────────────── */

function DigestCard({
  contact, latest, count, summary, isLoading, index, onOpen,
}: {
  contact: Contact | undefined;
  latest: Message;
  count: number;
  summary: string | undefined;
  isLoading: boolean;
  index: number;
  onOpen: () => void;
}) {
  return (
    <div
      className="glass pop"
      style={{ borderRadius: 20, animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start gap-3 p-3.5">
        {/* Avatar */}
        <Avatar
          name={contact?.name ?? '?'}
          grad={contact?.grad ?? 'linear-gradient(135deg,#94a3b8,#64748b)'}
          size={42}
          trusted={contact?.trusted}
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Row 1: name + time */}
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span className="font-semibold text-main truncate leading-tight">{contact?.name ?? 'Unknown'}</span>
            <span className="text-[11px] dim shrink-0">{latest.time}</span>
          </div>

          {/* Row 2: message count chip (only if >1) */}
          {count > 1 && (
            <span
              className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1"
              style={{ background: 'var(--accent)', color: '#fff', opacity: 0.85 }}
            >
              {count} messages
            </span>
          )}

          {/* Row 3: AI summary */}
          <div className="text-sm text-main leading-snug">
            {isLoading || !summary ? (
              <span className="flex items-center gap-1.5 dim">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: 'var(--accent)', opacity: 0.6, animation: 'pulse 1.2s ease-in-out infinite' }}
                />
                AI reading…
              </span>
            ) : (
              <span>{summary}</span>
            )}
          </div>

          {/* Row 4: category badge */}
          <div className="mt-1.5">
            <CategoryBadge category={latest.verdict?.category ?? 'clean'} />
          </div>
        </div>
      </div>

      {/* Divider + action */}
      <div
        className="flex items-center justify-end px-3.5 py-2 gap-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          onClick={onOpen}
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          <MessageSquare size={13} />
          Open chat
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────────────────── */

function DigestHeader() {
  return (
    <div className="glass-h px-4 pt-4 pb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className="grid place-items-center"
          style={{
            width: 34, height: 34, borderRadius: 11,
            background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
            boxShadow: '0 6px 18px -6px var(--accent)',
          }}
        >
          <Sparkles size={17} color="#fff" />
        </div>
        <div>
          <div className="font-semibold text-main leading-tight tracking-tight">Digest</div>
          <div className="text-[11px] dim leading-tight">AI reads · you decide</div>
        </div>
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────── */

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <div
        className="glass grid place-items-center mb-3"
        style={{ width: 62, height: 62, borderRadius: 20 }}
      >
        <Sparkles size={26} className="dim" />
      </div>
      <div className="font-semibold text-main">No messages yet</div>
      <div className="text-sm dim mt-1">Use the Test tab to send messages — they'll appear here as AI summaries.</div>
    </div>
  );
}
