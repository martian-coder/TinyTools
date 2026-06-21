import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bot, Send, ChevronRight, Loader2 } from 'lucide-react';
import { useSiftStore } from '../store';
import { parseIntent } from '../moderation/commander';
import type { Message } from '../types';

/* ── Types ──────────────────────────────────────────────────────────── */

interface Chip {
  label: string;
  action: 'open' | 'show_review';
  contactId?: string;
}

interface CmdMsg {
  id: string;
  role: 'ai' | 'user';
  text: string;
  chips?: Chip[];
  streaming?: boolean;
}

let _id = 0;
const nid = () => `cm${++_id}`;

/* ── Streaming queue hook ───────────────────────────────────────────── */
// Supports multiple addAI() calls that stream one after another,
// with a short typing-pause gap between each message.

function useChat() {
  const [msgs, setMsgs] = useState<CmdMsg[]>([]);
  const streamRef  = useRef<{ id: string; words: string[] } | null>(null);
  const pendingRef = useRef<{ text: string; chips?: Chip[] }[]>([]);
  const pauseRef   = useRef(0); // ticks to wait before starting next

  useEffect(() => {
    const t = setInterval(() => {
      if (streamRef.current) {
        const { id, words } = streamRef.current;
        if (words.length === 0) {
          streamRef.current = null;
          setMsgs(prev => prev.map(m => m.id === id ? { ...m, streaming: false } : m));
          pauseRef.current = 9; // ~380ms breathing room between bubbles
        } else {
          const [word, ...rest] = words;
          streamRef.current = { id, words: rest };
          setMsgs(prev =>
            prev.map(m => m.id === id ? { ...m, text: m.text ? m.text + ' ' + word : word } : m)
          );
        }
      } else if (pauseRef.current > 0) {
        pauseRef.current--;
      } else if (pendingRef.current.length > 0) {
        const next = pendingRef.current.shift()!;
        const id   = nid();
        setMsgs(prev => [...prev, { id, role: 'ai', text: '', chips: next.chips, streaming: true }]);
        streamRef.current = { id, words: next.text.split(' ') };
      }
    }, 42);
    return () => clearInterval(t);
  }, []);

  const addAI = useCallback((text: string, chips?: Chip[]) => {
    // Start immediately if nothing is in flight; otherwise queue it
    if (!streamRef.current && pauseRef.current === 0 && pendingRef.current.length === 0) {
      const id = nid();
      setMsgs(prev => [...prev, { id, role: 'ai', text: '', chips, streaming: true }]);
      streamRef.current = { id, words: text.split(' ') };
    } else {
      pendingRef.current.push({ text, chips });
    }
  }, []);

  const addUser = useCallback((text: string) => {
    // Flush pending queue so the user message appears immediately after current bubble
    setMsgs(prev => [...prev, { id: nid(), role: 'user', text }]);
  }, []);

  return { msgs, addAI, addUser };
}

/* ── Bubble component ───────────────────────────────────────────────── */
// Groups consecutive same-role messages (iMessage-style corners + tight gap).

function Bubble({
  m, isFirst, isLast, onChip,
}: {
  m: CmdMsg;
  isFirst: boolean;
  isLast: boolean;
  onChip: (chip: Chip) => void;
}) {
  const isAI = m.role === 'ai';

  // Corner radius: full on far side, grouped on near side
  const br = isAI
    ? {
        borderTopLeftRadius:    isFirst ? 18 : 6,
        borderBottomLeftRadius: isLast  ? 4  : 6,
        borderTopRightRadius:    18,
        borderBottomRightRadius: 18,
      }
    : {
        borderTopRightRadius:    isFirst ? 18 : 6,
        borderBottomRightRadius: isLast  ? 4  : 6,
        borderTopLeftRadius:     18,
        borderBottomLeftRadius:  18,
      };

  // Vertical gap: tight within a burst, full between role-switches
  const mt = isFirst ? undefined : 'mt-[3px]';

  return (
    <div className={`flex ${isAI ? 'justify-start' : 'justify-end'} ${mt ?? ''}`}>
      <div className={isAI ? 'max-w-[87%]' : 'max-w-[80%]'}>
        {isAI ? (
          <>
            <div
              className="glass px-4 py-2.5 text-sm text-main leading-relaxed"
              style={br}
            >
              {m.text}
              {/* blinking cursor while streaming */}
              {m.streaming && m.text && (
                <span
                  className="inline-block ml-0.5 w-[2px] h-[13px] align-text-bottom"
                  style={{ background: 'var(--accent)', opacity: 0.85, animation: 'pulse 0.9s ease-in-out infinite' }}
                />
              )}
              {/* loading dot when bubble is empty but streaming */}
              {m.streaming && !m.text && (
                <span className="flex items-center gap-1 py-0.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        background: 'var(--accent)', opacity: 0.5,
                        animation: `pulse 1.1s ease-in-out ${i * 0.22}s infinite`,
                      }}
                    />
                  ))}
                </span>
              )}
            </div>

            {/* Action chips — appear only after the bubble finishes streaming */}
            {!m.streaming && m.chips && m.chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {m.chips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => onChip(chip)}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 glass active:scale-95 transition-transform"
                    style={{ borderRadius: 999, color: 'var(--accent)', border: '1px solid var(--border2)' }}
                  >
                    {chip.label}
                    <ChevronRight size={11} />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            className="px-4 py-2.5 text-sm bubble-out"
            style={br}
          >
            {m.text}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Screen ─────────────────────────────────────────────────────────── */

export function Commander() {
  const contacts         = useSiftStore(s => s.contacts);
  const allMessages      = useSiftStore(s => s.messages);
  const settings         = useSiftStore(s => s.settings);
  const sendMessage      = useSiftStore(s => s.sendMessage);
  const approveMessage   = useSiftStore(s => s.approveMessage);
  const rejectMessage    = useSiftStore(s => s.rejectMessage);
  const openConversation = useSiftStore(s => s.openConversation);
  const setFolder        = useSiftStore(s => s.setFolder);
  const setScreen        = useSiftStore(s => s.setScreen);

  const { msgs, addAI, addUser } = useChat();
  const [draft, setDraft]        = useState('');
  const [busy, setBusy]          = useState(false);
  const bottomRef                = useRef<HTMLDivElement>(null);
  const briefedRef               = useRef(false);

  const unread = useMemo(() => {
    const ins = allMessages.filter(
      m => m.dir === 'in' && (m.status === 'delivered' || m.status === 'approved')
    );
    const byContact = new Map<string, Message[]>();
    for (const m of ins) {
      const arr = byContact.get(m.contactId) ?? [];
      arr.push(m);
      byContact.set(m.contactId, arr);
    }
    return [...byContact.entries()]
      .map(([cId, ms]) => {
        const sorted  = [...ms].sort((a, b) => b.ts - a.ts);
        const contact = contacts.find(x => x.id === cId);
        return { contact, latest: sorted[0], count: ms.length };
      })
      .sort((a, b) => b.latest.ts - a.latest.ts);
  }, [allMessages, contacts]);

  const heldMessages = useMemo(
    () => allMessages.filter(m => m.status === 'held'),
    [allMessages]
  );

  /* ── Briefing: one bubble per sender, not one giant paragraph ── */
  useEffect(() => {
    if (briefedRef.current) return;
    briefedRef.current = true;

    const total = unread.reduce((s, t) => s + t.count, 0);

    if (total === 0 && heldMessages.length === 0) {
      addAI("All clear — no new messages right now.");
      addAI("Head to Chats to start a conversation, or use the Test tab to simulate incoming messages.");
      return;
    }

    // Opening line
    const senders = unread.length;
    addAI(
      `You have ${total} message${total !== 1 ? 's' : ''} from ${senders} sender${senders !== 1 ? 's' : ''}.`
    );

    // One bubble per sender
    for (const { contact, latest, count } of unread.slice(0, 5)) {
      const name    = contact?.name ?? 'Unknown';
      const preview = latest.text.length > 52 ? latest.text.slice(0, 49) + '…' : latest.text;
      const badge   = count > 1 ? ` · ${count} msgs` : '';
      addAI(`${name}${badge} — "${preview}"`);
    }

    if (unread.length > 5) {
      addAI(`…and ${unread.length - 5} more conversations.`);
    }

    if (heldMessages.length > 0) {
      addAI(`${heldMessages.length} message${heldMessages.length !== 1 ? 's' : ''} waiting in your review queue.`);
    }

    // CTA with chips
    const chips: Chip[] = [
      ...unread.slice(0, 3).filter(t => t.contact).map(t => ({
        label:     `Open ${t.contact!.name}`,
        action:    'open' as const,
        contactId: t.contact!.id,
      })),
      ...(heldMessages.length > 0 ? [{ label: 'Show held', action: 'show_review' as const }] : []),
    ];

    addAI(
      "What should I do? Say 'reply [name] [message]', 'open [name]', 'approve all', or ask anything.",
      chips.length > 0 ? chips : undefined
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Scroll to bottom when messages grow */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  /* Chip action handler */
  const runChip = useCallback((chip: Chip) => {
    if (chip.action === 'open' && chip.contactId) {
      openConversation(chip.contactId);
    } else if (chip.action === 'show_review') {
      setFolder('review');
      setScreen('chats');
    }
  }, [openConversation, setFolder, setScreen]);

  /* Command dispatch */
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    addUser(text);
    setBusy(true);

    const apiKey = settings.aiReplies?.anthropicKey ?? '';
    const intent = await parseIntent(text, contacts, heldMessages, apiKey);

    let response = '';
    let chips: Chip[] | undefined;

    switch (intent.type) {
      case 'reply': {
        sendMessage(intent.contactId, intent.text);
        response = `Sent to ${intent.contactName} ✓`;
        chips = [{ label: `Open ${intent.contactName}`, action: 'open', contactId: intent.contactId }];
        break;
      }
      case 'open': {
        response = `Opening ${intent.contactName}'s chat…`;
        setTimeout(() => openConversation(intent.contactId), 650);
        break;
      }
      case 'approve': {
        const targets = intent.messageId
          ? heldMessages.filter(m => m.id === intent.messageId)
          : heldMessages;
        targets.forEach(m => approveMessage(m.id));
        response = targets.length > 0
          ? `Approved ${targets.length} message${targets.length !== 1 ? 's' : ''} ✓`
          : "Nothing to approve right now.";
        break;
      }
      case 'reject': {
        const targets = intent.messageId
          ? heldMessages.filter(m => m.id === intent.messageId)
          : heldMessages;
        targets.forEach(m => rejectMessage(m.id));
        response = targets.length > 0
          ? `Rejected ${targets.length} message${targets.length !== 1 ? 's' : ''} ✓`
          : "Nothing to reject right now.";
        break;
      }
      case 'show_review': {
        const n = heldMessages.length;
        if (n > 0) {
          response = `${n} held message${n !== 1 ? 's' : ''} — opening review queue…`;
          chips = heldMessages.slice(0, 3).map(m => {
            const c = contacts.find(x => x.id === m.contactId);
            return { label: c?.name ?? 'Unknown', action: 'open' as const, contactId: m.contactId };
          });
          setTimeout(() => { setFolder('review'); setScreen('chats'); }, 850);
        } else {
          response = "Your review queue is empty.";
        }
        break;
      }
      default: {
        response = "Try: 'reply Maya yes', 'open Alex', 'show held', 'approve all', or 'reject all'.";
      }
    }

    setBusy(false);
    addAI(response, chips);
  }, [
    draft, busy, contacts, heldMessages, settings.aiReplies,
    sendMessage, approveMessage, rejectMessage, openConversation,
    setFolder, setScreen, addUser, addAI,
  ]);

  /* Compute burst groups for iMessage-style corners */
  const rendered = msgs.map((m, i) => {
    const prev = msgs[i - 1];
    const next = msgs[i + 1];
    return {
      m,
      isFirst: !prev || prev.role !== m.role,
      isLast:  !next || next.role !== m.role,
    };
  });

  return (
    <>
      {/* Header */}
      <div className="glass-h px-4 pt-4 pb-3 flex items-center gap-2.5">
        <div
          className="grid place-items-center"
          style={{
            width: 34, height: 34, borderRadius: 11,
            background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
            boxShadow: '0 6px 18px -6px var(--accent)',
          }}
        >
          <Bot size={17} color="#fff" />
        </div>
        <div>
          <div className="font-semibold text-main leading-tight tracking-tight">Commander</div>
          <div className="text-[11px] dim leading-tight">your AI inbox assistant</div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 no-bar">
        <div>
          {rendered.map(({ m, isFirst, isLast }) => (
            <div key={m.id} className={isFirst ? 'mt-3 first:mt-0' : ''}>
              <Bubble m={m} isFirst={isFirst} isLast={isLast} onChip={runChip} />
            </div>
          ))}

          {/* Thinking indicator */}
          {busy && (
            <div className="mt-3 flex justify-start">
              <div
                className="glass px-4 py-3 flex items-center gap-1.5"
                style={{ borderRadius: 18, borderBottomLeftRadius: 4 }}
              >
                <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span className="text-xs dim">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="glass2 flex items-center gap-2 p-1.5" style={{ borderRadius: 999 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !busy && handleSend()}
            placeholder="Reply Maya, open Alex, show held…"
            className="flex-1 bg-transparent px-3 text-sm text-main outline-none placeholder:dim"
            disabled={busy}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || busy}
            className="grid place-items-center transition-opacity"
            style={{
              width: 38, height: 38, borderRadius: 999,
              background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
              opacity: !draft.trim() || busy ? 0.4 : 1,
              cursor:  !draft.trim() || busy ? 'not-allowed' : 'pointer',
            }}
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    </>
  );
}
