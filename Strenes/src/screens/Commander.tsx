import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, ChevronRight, Loader2 } from 'lucide-react';
import { useSiftStore } from '../store';
import { parseIntent, formatUntil } from '../moderation/commander';
import { proxyQuotaExceeded, localOnlyChosen, chooseLocalOnly, FREE_PROXY_LIMIT } from '../moderation/cloud';
import { createMeeting } from '../services/calendar';
import { describeSender, priorityFor } from '../moderation/insights';
import { PROFILES, CIRCLE_META, CIRCLE_ORDER, type Circle, type ProfileId } from '../moderation/profiles';
import type { Message } from '../types';

/* ── Types ──────────────────────────────────────────────────────────── */

interface Chip {
  label: string;
  action: 'open' | 'show_review' | 'command' | 'settings' | 'use_local';
  contactId?: string;
  command?: string;
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
  const addDynamicRule    = useSiftStore(s => s.addDynamicRule);
  const removeDynamicRule = useSiftStore(s => s.removeDynamicRule);
  const muteContact       = useSiftStore(s => s.muteContact);
  const unmuteContact     = useSiftStore(s => s.unmuteContact);
  const updateSettings    = useSiftStore(s => s.updateSettings);
  const applyProfile      = useSiftStore(s => s.applyProfile);
  const setContactCircle  = useSiftStore(s => s.setContactCircle);
  const addMemoryNote     = useSiftStore(s => s.addMemoryNote);
  const forgetMemory      = useSiftStore(s => s.forgetMemory);

  const { msgs, addAI, addUser } = useChat();
  const [draft, setDraft]        = useState('');
  const [busy, setBusy]          = useState(false);
  const bottomRef                = useRef<HTMLDivElement>(null);
  const briefedRef               = useRef(false);
  const quotaAskedRef            = useRef(false);

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
    const style = settings.commander?.summaryStyle ?? 'casual';
    const mutes = settings.mutes ?? {};
    const now   = Date.now();

    // Global snooze: everything is muted until the timestamp passes.
    if (mutes['*'] && mutes['*'] > now) {
      addAI(`🔇 All updates are muted ${formatUntil(mutes['*'])}. Say 'unmute all' to resume.`);
      if (heldMessages.length > 0) {
        addAI(`⚠️  ${heldMessages.length} message${heldMessages.length !== 1 ? 's' : ''} in review queue.`);
      }
      return;
    }

    // Muted contacts are excluded from the briefing until their mute expires.
    const visible = unread.filter(({ contact }) =>
      !(contact && mutes[contact.id] && mutes[contact.id] > now));
    const mutedCount = unread.length - visible.length;

    const total = visible.reduce((s, t) => s + t.count, 0);

    if (total === 0 && heldMessages.length === 0) {
      addAI(style === 'professional' ? 'No new messages to report.' : "All clear — no new messages right now.");
      if (mutedCount > 0) {
        addAI(`🔇 ${mutedCount} contact${mutedCount !== 1 ? 's are' : ' is'} muted. Say 'unmute <name>' to bring them back.`);
      } else {
        addAI("Head to Chats to start a conversation, or use the Test tab to simulate incoming messages.");
      }
      if (!settings.commander?.profile) {
        addAI("🛡️ New: pick a protection profile — 'use elder shield' for scam armor, 'public inbox' for creators, 'professional mode' for work, or 'minimal mode' for calm.");
      }
      return;
    }

    const senders = visible.length;
    addAI(
      style === 'professional'
        ? `Briefing: ${total} message${total !== 1 ? 's' : ''} from ${senders} sender${senders !== 1 ? 's' : ''}.`
        : `You have ${total} message${total !== 1 ? 's' : ''} from ${senders} sender${senders !== 1 ? 's' : ''}.`
    );

    // Life-situation awareness: acknowledge what the user is going through.
    const situations = (settings.memory ?? []).filter(nt => nt.kind === 'situation' && (!nt.expiresAt || nt.expiresAt > now));
    if (situations.length > 0) {
      const latest = situations[situations.length - 1];
      addAI(`💙 Keeping it gentle — I remember: "${latest.text.slice(0, 80)}${latest.text.length > 80 ? '…' : ''}"`);
    }

    type Priority = 'high' | 'medium' | 'low';

    const senderLine = (entry: typeof visible[number]) => {
      const { contact, latest, count } = entry;
      const name = contact?.name ?? 'Unknown';
      const { kind, summary } = describeSender(latest, style);
      const priority: Priority = priorityFor(kind, latest.verdict?.category);
      const badge = count > 1 ? ` (${count})` : '';
      return {
        priority,
        text: style === 'brief' ? `${name}${badge}: ${summary}` : `${name}${badge} — ${summary}`,
        chip: { label: `Open ${name}`, action: 'open' as const, contactId: contact?.id ?? '' },
      };
    };
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    // Your people first: circle sections in the order your persona cares about.
    const circleOrder = CIRCLE_ORDER[(settings.commander?.profile as ProfileId) ?? 'default'] ?? CIRCLE_ORDER.default;
    const circled = visible.filter(v => v.contact?.circle);
    const others = visible.filter(v => !v.contact?.circle);

    if (circled.length > 0) {
      for (const circle of circleOrder) {
        const members = circled.filter(v => v.contact!.circle === circle);
        if (members.length === 0) continue;
        const meta = CIRCLE_META[circle];
        addAI(`${meta.emoji} ${meta.label}`);
        members.map(senderLine).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
          .forEach(l => addAI(l.text, [l.chip]));
      }
      // Everyone outside your circles collapses into one line — signal, not noise.
      if (others.length > 0) {
        const otherCount = others.reduce((n, o) => n + o.count, 0);
        const urgent = others.map(senderLine).filter(l => l.priority === 'high');
        urgent.forEach(l => addAI(`⚠️ Also: ${l.text}`, [l.chip]));
        const rest = others.length - urgent.length;
        if (rest > 0) {
          addAI(`…plus ${otherCount} message${otherCount !== 1 ? 's' : ''} from ${rest} other sender${rest !== 1 ? 's' : ''} — nothing that can't wait. Say 'summary' anytime or check Chats.`);
        }
      }
    } else {
      /* No circles yet — classic priority view */
      const groups = visible.slice(0, 5).map(senderLine);
      groups.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      let currentPriority: Priority | null = null;
      for (const g of groups) {
        if (g.priority !== currentPriority) {
          const label = g.priority === 'high' ? '🔴 High Priority' : g.priority === 'medium' ? '🟡 Medium' : '⚪ Other';
          addAI(label);
          currentPriority = g.priority;
        }
        addAI(g.text, [g.chip]);
      }
      if (visible.length > 5) {
        addAI(`…and ${visible.length - 5} more conversations.`);
      }
      addAI("💡 Tell me who matters — 'Maya is family', 'Jay is work', 'Sara is my VIP' — and your people will lead every briefing while the rest collapses to one line.");
    }

    if (mutedCount > 0) {
      addAI(`🔇 ${mutedCount} contact${mutedCount !== 1 ? 's' : ''} muted — updates hidden.`);
    }

    if (heldMessages.length > 0) {
      addAI(`⚠️  ${heldMessages.length} message${heldMessages.length !== 1 ? 's' : ''} in review queue.`);
    }

    if (!settings.commander?.profile) {
      addAI("\u{1F6E1}\uFE0F New: pick a protection profile — 'use elder shield' for scam armor, 'public inbox' for creators, 'professional mode' for work, or 'minimal mode' for calm.");
    }
    addAI("Try: 'mute Maya for 4 hours', 'no rants today', 'summaries should be professional', 'reply Alex yes'.");
  }, [unread, heldMessages, addAI, settings]);

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
  const execRef = useRef<(text: string) => void>(() => {});
  const runChip = useCallback((chip: Chip) => {
    if (chip.action === 'command' && chip.command) {
      execRef.current(chip.command);
    } else if (chip.action === 'open' && chip.contactId) {
      openConversation(chip.contactId);
    } else if (chip.action === 'show_review') {
      setFolder('review');
      setScreen('chats');
    } else if (chip.action === 'settings') {
      setScreen('settings');
    } else if (chip.action === 'use_local') {
      chooseLocalOnly();
      addAI("👍 Done — Commander now runs fully on-device. Everything keeps working (a bit less fancy at parsing). Paste an API key in Settings anytime to switch back to cloud AI.");
    }
  }, [openConversation, setFolder, setScreen, addAI]);

  /* ── Core command execution ── */
  const executeCommand = useCallback(async (text: string) => {
    addUser(text);
    setBusy(true);

    // Whatever happens below — model hang, parser bug, network failure — the
    // spinner must clear and the user must get a reply.
    try {

    const apiKey = settings.aiReplies?.anthropicKey ?? '';
    let intent: Awaited<ReturnType<typeof parseIntent>>;
    try {
      intent = await parseIntent(text, contacts, heldMessages, apiKey);
    } catch {
      intent = { type: 'unknown', query: text };
    }

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

      case 'dynamic_rule': {
        if (intent.action === 'add' && intent.contactId && intent.condition && intent.ruleAction) {
          addDynamicRule(intent.contactId, intent.condition, intent.ruleAction, intent.expiresAt);
          const action = intent.ruleAction === 'block' ? 'block' : 'hold for review';
          const who = intent.contactId === '*' ? 'anyone' : intent.contactName;
          const when = intent.expiresAt ? ` · active ${formatUntil(intent.expiresAt)}` : '';
          responses.push({
            text: `✓ Rule set: will ${action} messages from ${who} matching "${intent.condition}"${when}. Say 'my rules' to manage.`,
          });
        } else if (intent.action === 'remove') {
          const now = Date.now();
          const active = settings.dynamicRules.filter(r => r.enabled && (!r.expiresAt || r.expiresAt > now));
          if (intent.ruleRef === 'all') {
            active.forEach(r => removeDynamicRule(r.id));
            responses.push({ text: active.length > 0 ? `✓ Cleared ${active.length} rule${active.length !== 1 ? 's' : ''}.` : 'No active rules to clear.' });
          } else if (intent.ruleRef && /^\d+$/.test(intent.ruleRef)) {
            const rule = active[parseInt(intent.ruleRef, 10) - 1];
            if (rule) {
              removeDynamicRule(rule.id);
              responses.push({ text: `✓ Removed rule ${intent.ruleRef}: "${rule.condition}"` });
            } else {
              responses.push({ text: `No rule #${intent.ruleRef}. Say 'my rules' to see the list.` });
            }
          } else if (intent.ruleRef) {
            const kw = intent.ruleRef.toLowerCase();
            const rule = active.find(r => r.condition.toLowerCase().includes(kw));
            if (rule) {
              removeDynamicRule(rule.id);
              responses.push({ text: `✓ Removed rule: "${rule.condition}"` });
            } else {
              responses.push({ text: `Couldn't find a rule about "${intent.ruleRef}". Say 'my rules' to see the list.` });
            }
          }
        } else {
          responses.push({ text: "Just tell me the rule in your own words — e.g. 'hold anything asking me for money', 'no rants today'." });
        }
        break;
      }

      case 'mute': {
        muteContact(intent.contactId, intent.untilTs);
        responses.push({
          text: intent.contactId === '*'
            ? `🔇 All updates muted ${formatUntil(intent.untilTs)} — briefings stay quiet until then. Messages still arrive in Chats. Say 'unmute all' to resume early.`
            : `🔇 ${intent.contactName} muted ${formatUntil(intent.untilTs)} — their updates are hidden from briefings. Messages still arrive quietly in Chats.`,
        });
        break;
      }

      case 'unmute': {
        if (intent.contactId === '*') {
          Object.keys(settings.mutes ?? {}).forEach(id => unmuteContact(id));
          responses.push({ text: '🔊 All updates unmuted — your briefings are back.' });
        } else {
          unmuteContact(intent.contactId);
          responses.push({
            text: `🔊 ${intent.contactName} unmuted — their updates are back in your briefings.`,
            chips: [{ label: `Open ${intent.contactName}`, action: 'open', contactId: intent.contactId }],
          });
        }
        break;
      }

      case 'remember': {
        addMemoryNote(intent.note, intent.kind, intent.expiresAt);
        if (intent.kind === 'situation') {
          const empathy: Record<string, string> = {
            breakup: "I'm sorry — that's heavy. I've noted it, and I'll keep your briefings gentle for a while.",
            exams: "Noted — exam season. Protect the focus; I can hold the noise.",
            grief: "I'm so sorry for your loss. I've noted it. Take all the time you need — I'll keep things quiet here.",
            health: "Noted — health first, messages later. I've got the inbox.",
            newjob: "Noted — big move! I'll keep distractions down while you find your feet.",
            baby: "Congratulations! Noted — expect me to guard your sleep like it's sacred.",
            wedding: "Congratulations! Noted — I'll help keep the chaos manageable.",
            moving: "Noted — moving is a lot. I'll keep the inbox light.",
            travel: "Noted — enjoy the trip. Want everything low-key while you're away?",
            stress: "Heard. I've noted it — let's lower the volume on everything that isn't essential.",
          };
          responses.push({
            text: empathy[intent.situationKind ?? 'stress'] ?? empathy.stress,
            chips: [
              { label: '🍃 Minimal mode', action: 'command', command: 'use minimal mode' },
              { label: '🔇 Mute all today', action: 'command', command: 'mute all msgs today' },
            ],
          });
          responses.push({ text: "This stays only on your device. Say 'what do you remember' anytime, or 'forget it' when it no longer applies." });
        } else {
          responses.push({ text: `🧠 Remembered: "${intent.note}". Stored only on this device — say 'what do you remember' to review.` });
        }
        break;
      }

      case 'forget': {
        const n = forgetMemory(intent.target);
        responses.push({
          text: intent.target === 'all'
            ? (n > 0 ? `✓ Forgot everything — ${n} note${n !== 1 ? 's' : ''} erased. Clean slate.` : 'Nothing to forget — my memory is already empty.')
            : (n > 0 ? `✓ Forgot ${n} note${n !== 1 ? 's' : ''} about "${intent.target}".` : `I had nothing about "${intent.target}".`),
        });
        break;
      }

      case 'memory_export': {
        const mem = (settings.memory ?? []).filter(nt => !nt.expiresAt || nt.expiresAt > Date.now());
        const circled = contacts.filter(c => c.circle);
        const rules = settings.dynamicRules.filter(r => r.enabled && (!r.expiresAt || r.expiresAt > Date.now()));
        const md = [
          '# Strenes — What I Remember', '',
          `_Exported ${new Date().toLocaleString()} · this file never leaves your device unless you share it._`, '',
          '## About you',
          ...(mem.filter(nt => nt.kind === 'fact').map(nt => `- ${nt.text}`) || []),
          ...(mem.filter(nt => nt.kind === 'fact').length === 0 ? ['- (nothing yet)'] : []),
          '', '## What you are going through',
          ...(mem.filter(nt => nt.kind === 'situation').map(nt => `- ${nt.text}${nt.expiresAt ? ` _(until ${new Date(nt.expiresAt).toLocaleDateString()})_` : ''}`)),
          ...(mem.filter(nt => nt.kind === 'situation').length === 0 ? ['- (nothing right now)'] : []),
          '', '## Your circles',
          ...(circled.length ? circled.map(c => `- ${c.name}: ${c.circle}`) : ['- (none set)']),
          '', '## Your rules',
          ...(rules.length ? rules.map(r => `- ${r.action} ${r.contactId === '*' ? 'anyone' : (contacts.find(c => c.id === r.contactId)?.name ?? r.contactId)}: "${r.condition}"`) : ['- (none)']),
          '', `## Setup`,
          `- Protection profile: ${settings.commander?.profile ?? 'none'}`,
          `- Summary style: ${settings.commander?.summaryStyle ?? 'casual'}`,
        ].join('\n');
        const blob = new Blob([md], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'strenes-memory.md';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        responses.push({ text: '📄 Downloaded strenes-memory.md — everything I remember, in a file you own.' });
        break;
      }

      case 'busy_window': {
        updateDND({ enabled: true, startHour: intent.startHour, endHour: intent.endHour, allowTrusted: true, allowEmergency: true, notifyButSilent: true });
        addMemoryNote(intent.note, 'fact');
        const fmt = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
        responses.push({
          text: `⏰ Got it — busy ${fmt(intent.startHour)}–${fmt(intent.endHour)}. In that window I hold non-urgent messages in Review; your 👪 Family & ⭐ VIP circles, trusted contacts, and emergencies still reach you instantly. Say "i'm free" to lift it early.`,
        });
        break;
      }

      case 'busy_off': {
        updateDND({ enabled: false });
        responses.push({ text: '✅ Busy window lifted — everything flows normally again.' });
        break;
      }

      case 'set_circle': {
        setContactCircle(intent.contactId, intent.circle ?? undefined);
        if (intent.circle) {
          const meta = CIRCLE_META[intent.circle];
          responses.push({
            text: `${meta.emoji} ${intent.contactName} is now in your ${meta.label} circle — their updates lead your briefings.`,
            chips: [{ label: `Open ${intent.contactName}`, action: 'open', contactId: intent.contactId }],
          });
        } else {
          responses.push({ text: `✓ ${intent.contactName} removed from your circles.` });
        }
        break;
      }

      case 'set_profile': {
        const prof = PROFILES[intent.profile];
        applyProfile(intent.profile);
        for (const line of prof.confirmation) responses.push({ text: line });
        responses.push({ text: "Say 'my settings' to see everything it changed, or just keep adding your own rules on top." });
        break;
      }

      case 'summary_style': {
        updateSettings({ commander: { summaryStyle: intent.style } });
        const sample = intent.style === 'professional'
          ? 'e.g. "Maya has shared a personal opinion"'
          : intent.style === 'brief'
          ? 'e.g. "Maya: opinion"'
          : 'e.g. "Maya is sharing an opinion"';
        responses.push({ text: `✓ Summaries will be ${intent.style} from now on (${sample}). Say 'summary' to see it.` });
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
            addAI("· Protection profiles — 'use elder shield' (scam armor), 'public inbox', 'professional mode', 'minimal mode'");
            addAI("· Circles — 'Maya is family', 'Jay is work', 'Sara is my VIP'. Your circles lead every briefing; everyone else is one summary line.");
            addAI("· Availability — 'I'm busy with calls from 5pm till 9pm' → I filter accordingly (circles & trusted still get through). 'i'm free' lifts it.");
            addAI("· Memory — 'remember my accountant is Sarah', 'I'm going through exams' (I adapt + keep it gentle), 'what do you remember', 'forget everything', 'export memory' (.md file). All on-device.");
            addAI("· Mute updates — 'mute Maya for 4 hours', 'mute all msgs for 2 hrs', 'dnd for 2 hours', 'unmute all'");
            addAI("· Rules in your own words — 'hold anything asking me for money', 'no rants today', 'never show me chain forwards'. I evaluate each incoming message against them with on-device AI.");
            addAI("· Manage rules — 'my rules', 'remove rule 2', 'clear all rules'");
            addAI("· Summary tone — 'summaries should be professional' (or casual / brief)");
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
          case 'memory': {
            const mem = (settings.memory ?? []).filter(nt => !nt.expiresAt || nt.expiresAt > Date.now());
            if (mem.length === 0) {
              responses.push({ text: "I don't remember anything yet. Tell me things — 'I'm busy with calls 5pm–9pm', 'remember my accountant is Sarah', 'I'm going through exams' — and I'll adapt around them. Everything stays on this device." });
            } else {
              responses.push({ text: `🧠 What I remember (${mem.length} note${mem.length !== 1 ? 's' : ''}, stored only on this device):` });
              mem.slice(-8).forEach(nt => {
                const tag = nt.kind === 'situation' ? '💙' : '·';
                const until = nt.expiresAt ? ` (until ${new Date(nt.expiresAt).toLocaleDateString()})` : '';
                responses.push({ text: `${tag} ${nt.text}${until}` });
              });
              responses.push({ text: "Say 'forget <word>', 'forget everything', or 'export memory' to download it as a file." });
            }
            break;
          }
          case 'circles': {
            const circled = contacts.filter(c => c.circle);
            if (circled.length === 0) {
              responses.push({ text: "No circles yet. Tell me who matters — 'Maya is family', 'Jay is work', 'Sara is my VIP' — and their updates will lead every briefing." });
            } else {
              const order: Circle[] = ['vip', 'family', 'friends', 'work'];
              for (const circle of order) {
                const members = circled.filter(c => c.circle === circle);
                if (members.length > 0) {
                  const meta = CIRCLE_META[circle];
                  responses.push({ text: `${meta.emoji} ${meta.label}: ${members.map(c => c.name).join(', ')}` });
                }
              }
              responses.push({ text: "Say 'remove <name> from circles' to change, or '<name> is <circle>' to add more." });
            }
            break;
          }
          case 'rules': {
            const now = Date.now();
            const active = settings.dynamicRules.filter(r => r.enabled && (!r.expiresAt || r.expiresAt > now));
            if (active.length === 0) {
              responses.push({ text: "No active rules. Just tell me one in your own words — e.g. 'hold anything asking me for money', 'no rants from Jay this week'." });
            } else {
              responses.push({ text: `${active.length} active rule${active.length !== 1 ? 's' : ''}:` });
              active.slice(0, 8).forEach((r, i) => {
                const who = r.contactId === '*' ? 'anyone' : (contacts.find(c => c.id === r.contactId)?.name ?? r.contactId);
                const when = r.expiresAt ? ` · ${formatUntil(r.expiresAt)}` : '';
                responses.push({ text: `${i + 1}. ${r.action} ${who}: "${r.condition}"${when}` });
              });
              responses.push({ text: "Say 'remove rule 1' or 'clear all rules' to manage them." });
            }
            break;
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
            const now = Date.now();
            const activeMutes = Object.entries(settings.mutes ?? {}).filter(([, until]) => until > now);
            if (activeMutes.length > 0) {
              const names = activeMutes.map(([id, until]) => {
                const label = id === '*' ? 'Everyone' : (contacts.find(x => x.id === id)?.name ?? id);
                return `${label} (${formatUntil(until)})`;
              });
              responses.push({ text: `🔇 Muted: ${names.join(', ')}` });
            }
            const activeRules = settings.dynamicRules.filter(r => r.enabled && (!r.expiresAt || r.expiresAt > now));
            if (activeRules.length > 0) {
              const lines = activeRules.slice(0, 4).map(r => {
                const who = r.contactId === '*' ? 'anyone' : (contacts.find(c => c.id === r.contactId)?.name ?? r.contactId);
                return `${r.action} ${who}: "${r.condition}"${r.expiresAt ? ` (${formatUntil(r.expiresAt)})` : ''}`;
              });
              responses.push({ text: `Rules: ${lines.join(' · ')}` });
            }
            responses.push({ text: `Summary style: ${settings.commander?.summaryStyle ?? 'casual'}` });
            break;
          }
        }
        break;
      }

      case 'schedule': {
        const when = new Date(intent.startTs).toLocaleString([], {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
        const result = await createMeeting({
          title: intent.title,
          startTs: intent.startTs,
          endTs: intent.startTs + intent.durationMinutes * 60_000,
          details: 'Scheduled via Strenes Commander',
        });
        if (result.mode === 'api') {
          responses.push({
            text: `📅 "${intent.title}" is on your Google Calendar for ${when} (${intent.durationMinutes} min)${result.meetLink ? ` — Meet link attached: ${result.meetLink}` : ''} ✓`,
          });
        } else {
          window.open(result.url, '_blank', 'noopener');
          responses.push({
            text: `📅 Opening Google Calendar with "${intent.title}" prefilled for ${when} (${intent.durationMinutes} min) — tap Save there to confirm.`,
          });
        }
        break;
      }

      default: {
        responses.push({
          text: "I didn't catch that. You can state any rule in your own words — 'hold anything asking me for money', 'mute Jay for 4 hours' — or try 'reply Maya yes', 'my rules', 'help'.",
        });
      }
    }

    for (const r of responses) addAI(r.text, r.chips);

    // Free cloud-AI quota spent, no personal key, no choice made yet →
    // ask once per session how to continue.
    const hasOwnKey = !!(settings.aiReplies?.anthropicKey?.trim() || settings.aiModeration?.anthropicKey?.trim());
    if (proxyQuotaExceeded() && !hasOwnKey && !localOnlyChosen() && !quotaAskedRef.current) {
      quotaAskedRef.current = true;
      addAI(
        `⚡ You've used all ${FREE_PROXY_LIMIT} free Strenes AI requests. Pick how to continue — both options keep Commander working:`,
        [
          { label: '🔑 Add my API key', action: 'settings' },
          { label: '📱 Use on-device AI', action: 'use_local' },
        ],
      );
    }

    } catch {
      addAI("Something went wrong handling that — please try again.");
    } finally {
      setBusy(false);
    }
  }, [
    contacts, heldMessages, allMessages, settings,
    sendMessage, approveMessage, rejectMessage, openConversation,
    setFolder, setScreen, setContactTrusted, updateCivility, updateSpam, updateDND,
    addDynamicRule, removeDynamicRule, muteContact, unmuteContact, updateSettings, applyProfile, setContactCircle, addMemoryNote, forgetMemory, addUser, addAI, doBriefing,
  ]);

  useEffect(() => { execRef.current = executeCommand; }, [executeCommand]);

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
    if (!settings.commander?.profile) {
      chips.push({ label: '\u{1F6E1}\uFE0F Elder Shield', command: 'use elder shield' });
      chips.push({ label: '\u{1F4E3} Public Inbox', command: 'use public inbox mode' });
      chips.push({ label: '\u{1F4BC} Professional', command: 'use professional mode' });
    }
    chips.push({ label: 'No rants today', command: 'no ranting messages today' });
    chips.push({ label: 'My settings', command: 'my settings' });
    chips.push({ label: 'Help', command: 'help' });
    return chips.slice(0, 6);
  }, [heldMessages, unread, settings.commander?.profile]);

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
      {/* Screen title lives in the app header (App.tsx) — no local header. */}

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
      {/* The bottom nav is position:fixed — reserve its height so it never
          covers the input box. */}
      <div className="px-3 pt-1" style={{ paddingBottom: 'calc(var(--nav-height) + 16px)' }}>
        <div className="glass2 flex items-center gap-2 p-1.5" style={{ borderRadius: 999 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !busy && handleSend()}
            placeholder="Mute Maya 4 hrs, no rants today, reply Alex…"
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
