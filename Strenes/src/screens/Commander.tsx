import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bot, Send, ChevronRight, Loader2 } from 'lucide-react';
import { useSiftStore } from '../store';
import { parseIntent } from '../moderation/commander';
import type { Message } from '../types';

/* ── Message model ──────────────────────────────────────────────────── */

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

/* ── Word-by-word streaming hook ────────────────────────────────────── */

function useChat() {
  const [msgs, setMsgs] = useState<CmdMsg[]>([]);
  const queueRef = useRef<{ id: string; words: string[] } | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      if (!queueRef.current) return;
      const { id, words } = queueRef.current;
      if (words.length === 0) {
        queueRef.current = null;
        setMsgs(prev => prev.map(m => m.id === id ? { ...m, streaming: false } : m));
        return;
      }
      const [word, ...rest] = words;
      queueRef.current = { id, words: rest };
      setMsgs(prev =>
        prev.map(m => m.id === id ? { ...m, text: m.text ? m.text + ' ' + word : word } : m)
      );
    }, 42);
    return () => clearInterval(t);
  }, []);

  const addAI = useCallback((text: string, chips?: Chip[]) => {
    const id = nid();
    setMsgs(prev => [...prev, { id, role: 'ai', text: '', chips, streaming: true }]);
    queueRef.current = { id, words: text.split(' ') };
  }, []);

  const addUser = useCallback((text: string) => {
    setMsgs(prev => [...prev, { id: nid(), role: 'user', text }]);
  }, []);

  return { msgs, addAI, addUser };
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
  const [draft, setDraft]       = useState('');
  const [busy, setBusy]         = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const briefedRef              = useRef(false);

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

  /* Briefing on first mount */
  useEffect(() => {
    if (briefedRef.current) return;
    briefedRef.current = true;

    const total = unread.reduce((s, t) => s + t.count, 0);

    if (total === 0 && heldMessages.length === 0) {
      addAI(
        "All clear! No new messages right now. Head to the Chats tab to start a conversation, or use the Test tab to simulate incoming messages."
      );
      return;
    }

    const parts: string[] = [];

    if (total > 0) {
      parts.push(
        `You have ${total} message${total > 1 ? 's' : ''} from ${unread.length} sender${unread.length > 1 ? 's' : ''}.`
      );
      for (const { contact, latest, count } of unread.slice(0, 5)) {
        const name    = contact?.name ?? 'Unknown';
        const preview = latest.text.length > 55 ? latest.text.slice(0, 52) + '…' : latest.text;
        const extra   = count > 1 ? ` (${count} messages)` : '';
        parts.push(`${name}${extra}: "${preview}"`);
      }
      if (unread.length > 5) parts.push(`…and ${unread.length - 5} more senders.`);
    }

    if (heldMessages.length > 0) {
      parts.push(
        `${heldMessages.length} message${heldMessages.length > 1 ? 's are' : ' is'} held for review.`
      );
    }

    parts.push("Tell me what to do — try 'reply Maya yes', 'open Alex', 'show held messages', or 'approve all'.");

    const chips: Chip[] = [
      ...unread.slice(0, 3).filter(t => t.contact).map(t => ({
        label:     `Open ${t.contact!.name}`,
        action:    'open' as const,
        contactId: t.contact!.id,
      })),
      ...(heldMessages.length > 0 ? [{ label: 'Show held', action: 'show_review' as const }] : []),
    ];

    addAI(parts.join(' '), chips.length > 0 ? chips : undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Scroll to bottom on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  const runChip = useCallback((chip: Chip) => {
    if (chip.action === 'open' && chip.contactId) {
      openConversation(chip.contactId);
    } else if (chip.action === 'show_review') {
      setFolder('review');
      setScreen('chats');
    }
  }, [openConversation, setFolder, setScreen]);

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
        response = `Sent to ${intent.contactName}: "${intent.text}" ✓`;
        chips = [{ label: `Open ${intent.contactName}`, action: 'open', contactId: intent.contactId }];
        break;
      }
      case 'open': {
        response = `Opening ${intent.contactName}'s chat…`;
        setTimeout(() => openConversation(intent.contactId), 700);
        break;
      }
      case 'approve': {
        const targets = intent.messageId
          ? heldMessages.filter(m => m.id === intent.messageId)
          : heldMessages;
        targets.forEach(m => approveMessage(m.id));
        response = targets.length > 0
          ? `Approved ${targets.length} message${targets.length > 1 ? 's' : ''} ✓`
          : "No held messages to approve.";
        break;
      }
      case 'reject': {
        const targets = intent.messageId
          ? heldMessages.filter(m => m.id === intent.messageId)
          : heldMessages;
        targets.forEach(m => rejectMessage(m.id));
        response = targets.length > 0
          ? `Rejected ${targets.length} message${targets.length > 1 ? 's' : ''} ✓`
          : "No held messages to reject.";
        break;
      }
      case 'show_review': {
        const n = heldMessages.length;
        if (n > 0) {
          response = `You have ${n} held message${n > 1 ? 's' : ''}. Opening review queue…`;
          chips = heldMessages.slice(0, 3).map(m => {
            const c = contacts.find(x => x.id === m.contactId);
            return { label: c?.name ?? 'Unknown', action: 'open' as const, contactId: m.contactId };
          });
          setTimeout(() => { setFolder('review'); setScreen('chats'); }, 900);
        } else {
          response = "Your review queue is empty — nothing held right now.";
        }
        break;
      }
      default: {
        response = "I didn't quite catch that. Try: 'reply Maya yes I'll be there', 'open Alex', 'show held messages', 'approve all', or 'reject all'.";
      }
    }

    setBusy(false);
    addAI(response, chips);
  }, [
    draft, busy, contacts, heldMessages, settings.aiReplies,
    sendMessage, approveMessage, rejectMessage, openConversation,
    setFolder, setScreen, addUser, addAI,
  ]);

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

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 no-bar">
        <div className="space-y-3">
          {msgs.map(m =>
            m.role === 'ai' ? (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[87%]">
                  <div
                    className="glass px-4 py-3 text-sm text-main leading-relaxed"
                    style={{ borderRadius: 18, borderBottomLeftRadius: 4 }}
                  >
                    {m.text}
                    {m.streaming && (
                      <span
                        className="inline-block ml-0.5 w-[2px] h-3.5 align-text-bottom"
                        style={{ background: 'var(--accent)', opacity: 0.8, animation: 'pulse 0.9s ease-in-out infinite' }}
                      />
                    )}
                    {!m.text && m.streaming && (
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: 'var(--accent)', opacity: 0.6, animation: 'pulse 1s ease-in-out infinite' }}
                      />
                    )}
                  </div>

                  {/* Action chips — only shown after streaming finishes */}
                  {!m.streaming && m.chips && m.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.chips.map((chip, i) => (
                        <button
                          key={i}
                          onClick={() => runChip(chip)}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 glass active:scale-95 transition-transform"
                          style={{ borderRadius: 999, color: 'var(--accent)', border: '1px solid var(--border2)' }}
                        >
                          {chip.label}
                          <ChevronRight size={11} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-end">
                <div
                  className="max-w-[78%] px-4 py-2.5 text-sm bubble-out"
                  style={{ borderRadius: 18, borderBottomRightRadius: 4 }}
                >
                  {m.text}
                </div>
              </div>
            )
          )}

          {/* Processing indicator */}
          {busy && (
            <div className="flex justify-start">
              <div
                className="glass px-4 py-3 flex items-center gap-2"
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

      {/* Input bar */}
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
