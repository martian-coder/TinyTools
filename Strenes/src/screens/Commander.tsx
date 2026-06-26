import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, ChevronRight, Loader2 } from 'lucide-react';
import { useSiftStore } from '../store';
import { parseIntent } from '../moderation/commander';
import type { Message } from '../types';

/* ── Types ──────────────────────────────────────────────────────────── */

interface Chip {
  label: string;
  action: 'open' | 'show_review';
  contactId?: string;
}

interface SuggestChip {
  label: string;
  command: string;
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
                    style={{ borderRadius: 999, color: 'var(--accent)', border: '1px solid var(--line)' }}
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
  const contacts          = useSiftStore(s => s.contacts);
  const allMessages       = useSiftStore(s => s.messages);
  const settings          = useSiftStore(s => s.settings);
  const sendMessage       = useSiftStore(s => s.sendMessage);
  const approveMessage    = useSiftStore(s => s.approveMessage);
  const rejectMessage     = useSiftStore(s => s.rejectMessage);
  const openConversation  = useSiftStore(s => s.openConversation);
  const setFolder         = useSiftStore(s => s.setFolder);
  const setScreen         = useSiftStore(s => s.setScreen);
  const setContactTrusted = useSiftStore(s => s.setContactTrusted);
  const updateCivility    = useSiftStore(s => s.updateCivility);
  const updateSpam        = useSiftStore(s => s.updateSpam);
  const updateDND         = useSiftStore(s => s.updateDND);

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

  /* ── Briefing helper (reused for initial load + 'summary' query) ── */
  const doBriefing = useCallback(() => {
    const total = unread.reduce((s, t) => s + t.count, 0);

    if (total === 0 && heldMessages.length === 0) {
      addAI("All clear — no new messages right now.");
      addAI("Head to Chats to start a conversation, or use the Test tab to simulate incoming messages.");
      return;
    }

    const senders = unread.length;
    addAI(
      `You have ${total} message${total !== 1 ? 's' : ''} from ${senders} sender${senders !== 1 ? 's' : ''}.`
    );

    for (const { contact, latest, count } of unread.slice(0, 5)) {
      const name    = contact?.name ?? 'Unknown';
      const preview = latest.text.length > 52 ? latest.text.slice(0, 49) + '…' : latest.text;
      const badge   = count > 1 ? ` · ${count} msgs` : '';
      addAI(`${name}${badge} — "${preview}"`, [
        { label: `Open ${name}`, action: 'open' as const, contactId: contact?.id ?? '' },
      ]);
    }

    if (unread.length > 5) {
      addAI(`…and ${unread.length - 5} more conversations.`);
    }

    if (heldMessages.length > 0) {
      addAI(`${heldMessages.length} message${heldMessages.length !== 1 ? 's' : ''} waiting in your review queue.`);
    }

    addAI("What should I do? Say 'reply [name] [message]', 'open [name]', 'approve all', or ask anything.");
  }, [unread, heldMessages, addAI]);

  /* ── Briefing: one bubble per sender, only once on mount ── */
  useEffect(() => {
    if (briefedRef.current) return;
    briefedRef.current = true;
    doBriefing();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Scroll to bottom when messages grow */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  /* Inline chip action handler */
  const runChip = useCallback((chip: Chip) => {
    if (chip.action === 'open' && chip.contactId) {
      openConversation(chip.contactId);
    } else if (chip.action === 'show_review') {
      setFolder('review');
      setScreen('chats');
    }
  }, [openConversation, setFolder, setScreen]);

  /* ── Core command execution ── */
  const executeCommand = useCallback(async (text: string) => {
    addUser(text);
    setBusy(true);

    const apiKey = settings.aiReplies?.anthropicKey ?? '';
    const intent = await parseIntent(text, contacts, heldMessages, apiKey);

    const responses: { text: string; chips?: Chip[] }[] = [];

    switch (intent.type) {
      case 'reply': {
        sendMessage(intent.contactId, intent.text);
        responses.push({
          text: `Sent to ${intent.contactName} ✓`,
          chips: [{ label: `Open ${intent.contactName}`, action: 'open', contactId: intent.contactId }],
        });
        break;
      }

      case 'open': {
        responses.push({ text: `Opening ${intent.contactName}'s chat…` });
        setTimeout(() => openConversation(intent.contactId), 650);
        break;
      }

      case 'approve': {
        const targets = intent.messageId
          ? heldMessages.filter(m => m.id === intent.messageId)
          : heldMessages;
        targets.forEach(m => approveMessage(m.id));
        responses.push({
          text: targets.length > 0
            ? `Approved ${targets.length} message${targets.length !== 1 ? 's' : ''} ✓`
            : "Nothing to approve right now.",
        });
        break;
      }

      case 'reject': {
        const targets = intent.messageId
          ? heldMessages.filter(m => m.id === intent.messageId)
          : heldMessages;
        targets.forEach(m => rejectMessage(m.id));
        responses.push({
          text: targets.length > 0
            ? `Rejected ${targets.length} message${targets.length !== 1 ? 's' : ''} ✓`
            : "Nothing to reject right now.",
        });
        break;
      }

      case 'show_review': {
        const n = heldMessages.length;
        if (n > 0) {
          const chips = heldMessages.slice(0, 3).map(m => {
            const c = contacts.find(x => x.id === m.contactId);
            return { label: c?.name ?? 'Unknown', action: 'open' as const, contactId: m.contactId };
          });
          responses.push({ text: `${n} held message${n !== 1 ? 's' : ''} — opening review queue…`, chips });
          setTimeout(() => { setFolder('review'); setScreen('chats'); }, 850);
        } else {
          responses.push({ text: "Your review queue is empty." });
        }
        break;
      }

      case 'set_rule': {
        switch (intent.rule) {
          case 'trust': {
            if (intent.contactId) {
              setContactTrusted(intent.contactId, true);
              responses.push({
                text: `${intent.contactName} trusted — their messages will bypass the civility filter.`,
                chips: [{ label: `Open ${intent.contactName}`, action: 'open', contactId: intent.contactId }],
              });
            } else {
              responses.push({ text: "Which contact should I trust? Try 'trust Maya'." });
            }
            break;
          }
          case 'distrust': {
            if (intent.contactId) {
              setContactTrusted(intent.contactId, false);
              responses.push({ text: `${intent.contactName} removed from trusted contacts — messages will be filtered again.` });
            } else {
              responses.push({ text: "Which contact? Try 'don't trust Dave'." });
            }
            break;
          }
          case 'sensitivity': {
            if (intent.value && ['low', 'medium', 'high'].includes(intent.value)) {
              const v = intent.value as 'low' | 'medium' | 'high';
              updateCivility({ sensitivity: v });
              const desc = v === 'high'
                ? 'will catch borderline language too'
                : v === 'low'
                ? 'will only block clear violations'
                : 'balances sensitivity and permissiveness';
              responses.push({ text: `Civility sensitivity set to ${v} — filter ${desc}.` });
            } else {
              responses.push({ text: "Try 'set sensitivity to low', 'medium', or 'high'." });
            }
            break;
          }
          case 'civility_toggle': {
            const on = intent.value === 'on';
            updateCivility({ enabled: on });
            responses.push({ text: `Civility filter ${on ? 'enabled' : 'disabled'}.` });
            break;
          }
          case 'spam_toggle': {
            const on = intent.value === 'on';
            updateSpam({ enabled: on });
            responses.push({ text: `Spam filter ${on ? 'enabled' : 'disabled'}.` });
            break;
          }
          case 'dnd_toggle': {
            const on = intent.value === 'on';
            updateDND({ enabled: on });
            responses.push({ text: `Do Not Disturb ${on ? 'enabled — notifications paused' : 'disabled — back to normal'}.` });
            break;
          }
        }
        break;
      }

      case 'query': {
        switch (intent.subject) {
          case 'capabilities': {
            setBusy(false);
            addAI("Here's what I can do:");
            addAI("· Reply — 'reply Maya sounds good' · Open — 'open Alex'");
            addAI("· Approve / reject held messages — 'approve all', 'reject all'");
            addAI("· Trust contacts — 'trust Sarah' / 'don't trust Dave'");
            addAI("· Adjust the filter — 'set sensitivity to high', 'turn off spam filter'");
            addAI("· Questions — 'how many held?', 'messages from Alex', 'summary', 'my settings'");
            return;
          }
          case 'held_count': {
            const n = heldMessages.length;
            if (n === 0) {
              responses.push({ text: "Review queue is empty — nothing held right now." });
            } else {
              responses.push({
                text: `${n} message${n !== 1 ? 's' : ''} waiting in your review queue.`,
                chips: [{ label: 'Show held', action: 'show_review' as const }],
              });
            }
            break;
          }
          case 'contact_messages': {
            if (intent.contactId) {
              const contactMsgs = allMessages
                .filter(m => m.contactId === intent.contactId && m.dir === 'in')
                .sort((a, b) => b.ts - a.ts)
                .slice(0, 4);
              if (contactMsgs.length === 0) {
                responses.push({ text: `No incoming messages from ${intent.contactName}.` });
              } else {
                responses.push({ text: `Recent from ${intent.contactName}:` });
                for (const cm of contactMsgs.slice(0, 3)) {
                  const preview = cm.text.length > 80 ? cm.text.slice(0, 77) + '…' : cm.text;
                  responses.push({ text: `"${preview}"` });
                }
                responses.push({
                  text: `Showing last ${Math.min(contactMsgs.length, 3)} of ${contactMsgs.length} message${contactMsgs.length !== 1 ? 's' : ''}.`,
                  chips: [{ label: `Open ${intent.contactName}`, action: 'open', contactId: intent.contactId }],
                });
              }
            } else {
              responses.push({ text: "Which contact? Try 'messages from Maya'." });
            }
            break;
          }
          case 'summary': {
            setBusy(false);
            doBriefing();
            return;
          }
          case 'settings': {
            const civ  = settings.civility;
            const spam = settings.spam;
            const dnd  = settings.dnd;
            responses.push({ text: "Your current filter settings:" });
            responses.push({
              text: `Civility: ${civ.enabled ? `on · ${civ.sensitivity} sensitivity` : 'off'} · Spam: ${spam.enabled ? 'on' : 'off'} · DND: ${dnd?.enabled ? 'on' : 'off'}`,
            });
            const trusted = contacts.filter(c => c.trusted);
            responses.push({
              text: trusted.length > 0
                ? `Trusted (bypass filter): ${trusted.map(c => c.name).join(', ')}`
                : 'No trusted contacts — all incoming messages go through the filter.',
            });
            break;
          }
        }
        break;
      }

      default: {
        responses.push({
          text: "Try: 'reply Maya yes', 'open Alex', 'approve all', 'trust Sarah', 'set sensitivity to high', or 'my settings'.",
        });
      }
    }

    setBusy(false);
    for (const r of responses) addAI(r.text, r.chips);
  }, [
    contacts, heldMessages, allMessages, settings,
    sendMessage, approveMessage, rejectMessage, openConversation,
    setFolder, setScreen, setContactTrusted, updateCivility, updateSpam, updateDND,
    addUser, addAI, doBriefing,
  ]);

  /* Send handler */
  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    executeCommand(text);
  }, [draft, busy, executeCommand]);

  /* Suggestion chip tap runner */
  const runSuggestChip = useCallback((command: string) => {
    if (busy) return;
    executeCommand(command);
  }, [busy, executeCommand]);

  /* Contextual suggestion chips above the input bar */
  const suggestionChips = useMemo<SuggestChip[]>(() => {
    const chips: SuggestChip[] = [];
    if (heldMessages.length > 0) {
      chips.push({ label: `Approve all (${heldMessages.length})`, command: 'approve all' });
      chips.push({ label: 'Show held', command: 'show held' });
    }
    for (const { contact } of unread.slice(0, 2)) {
      if (contact) chips.push({ label: `Open ${contact.name}`, command: `open ${contact.name}` });
    }
    chips.push({ label: 'My settings', command: 'my settings' });
    chips.push({ label: 'Help', command: 'help' });
    return chips.slice(0, 5);
  }, [heldMessages, unread]);

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

      {/* Suggestion chips — contextual quick-tap row */}
      {suggestionChips.length > 0 && (
        <div className="px-3 pb-1 flex gap-1.5 overflow-x-auto no-bar">
          {suggestionChips.map((sc, i) => (
            <button
              key={i}
              onClick={() => runSuggestChip(sc.command)}
              disabled={busy}
              className="flex-shrink-0 text-[10px] font-medium px-2 py-0.5 glass active:scale-95 transition-transform disabled:opacity-40"
              style={{ borderRadius: 999, color: 'var(--accent)', border: '1px solid var(--line)' }}
            >
              {sc.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="glass2 flex items-center gap-2 p-1.5" style={{ borderRadius: 999 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !busy && handleSend()}
            placeholder="Reply, open, trust, approve, my settings…"
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
