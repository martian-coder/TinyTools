import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ShieldCheck, Send, Loader2, Lock, Clock } from 'lucide-react';
import { useSiftStore, selectConversation } from '../store';
import { Avatar } from '../components/ui/Avatar';
import { getModerator } from '../moderation';
import type { ModerationVerdict } from '../types';

type OutgoingState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'clean' }
  | { kind: 'review';  verdict: ModerationVerdict }
  | { kind: 'blocked'; verdict: ModerationVerdict };

export function Conversation() {
  const activeContactId      = useSiftStore(s => s.activeContactId);
  const contacts             = useSiftStore(s => s.contacts);
  const settings             = useSiftStore(s => s.settings);
  const setScreen            = useSiftStore(s => s.setScreen);
  const sendMessage          = useSiftStore(s => s.sendMessage);
  const sendOutgoingToReview = useSiftStore(s => s.sendOutgoingToReview);
  const messages             = useSiftStore(s => activeContactId ? selectConversation(s, activeContactId) : []);

  const [draft, setDraft]         = useState('');
  const [outgoing, setOutgoing]   = useState<OutgoingState>({ kind: 'idle' });
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  const contact    = contacts.find(c => c.id === activeContactId);
  const { civility } = settings;
  const guardActive  = civility.enabled && civility.sensitivity !== 'low';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Debounced live classification — runs 700ms after the user stops typing
  const classify = useCallback(async (text: string) => {
    if (!text || !guardActive) { setOutgoing({ kind: 'idle' }); return; }
    setOutgoing({ kind: 'checking' });
    try {
      const mod     = await getModerator();
      const verdict = await mod.classify(text, { sensitivity: civility.sensitivity });
      const flagged = verdict.category === 'abusive' || verdict.category === 'spam';
      if (!flagged) {
        setOutgoing({ kind: 'clean' });
      } else if (civility.sensitivity === 'high') {
        setOutgoing({ kind: 'blocked', verdict });
      } else {
        // medium + flagged → will go to review
        setOutgoing({ kind: 'review', verdict });
      }
    } catch {
      setOutgoing({ kind: 'clean' }); // fail open
    }
  }, [guardActive, civility.sensitivity]);

  const onDraftChange = (text: string) => {
    setDraft(text);
    if (!text.trim()) { setOutgoing({ kind: 'idle' }); return; }
    if (!guardActive)  { setOutgoing({ kind: 'idle' }); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => classify(text.trim()), 700);
  };

  const sendOut = () => {
    const text = draft.trim();
    if (!text || !activeContactId) return;
    if (outgoing.kind === 'blocked') return;
    if (outgoing.kind === 'checking') return;

    if (outgoing.kind === 'review') {
      sendOutgoingToReview(activeContactId, text, (outgoing as { kind: 'review'; verdict: ModerationVerdict }).verdict);
    } else {
      sendMessage(activeContactId, text);
    }
    setDraft('');
    setOutgoing({ kind: 'idle' });
  };

  if (!contact) return null;

  const sendDisabled =
    !draft.trim() ||
    outgoing.kind === 'blocked' ||
    outgoing.kind === 'checking';

  return (
    <>
      {/* Header */}
      <div className="glass-h px-3 py-3 flex items-center gap-3">
        <button onClick={() => setScreen('chats')} className="text-main"><ArrowLeft size={20} /></button>
        <Avatar name={contact.name} grad={contact.grad} size={36} trusted={contact.trusted} />
        <div className="flex-1">
          <div className="font-semibold text-main leading-tight">{contact.name}</div>
          {contact.trusted
            ? <div className="text-[11px] flex items-center gap-1 accent-t"><ShieldCheck size={11} /> Trusted · filters off</div>
            : civility.enabled && <div className="text-[11px] flex items-center gap-1 dim"><Lock size={10} /> {civility.sensitivity} civility filter</div>
          }
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-4 no-bar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.dir === 'out' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] px-3.5 py-2 text-sm pop ${m.dir === 'out' ? 'bubble-out' : 'bubble-in text-main'}`}
              style={{
                borderRadius: 18,
                borderBottomRightRadius: m.dir === 'out' ? 6 : 18,
                borderBottomLeftRadius:  m.dir === 'out' ? 18 : 6,
                opacity: m.dir === 'out' && m.status === 'held' ? 0.7 : 1,
              }}
            >
              {m.text}
              <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${m.dir === 'out' ? 'out-time justify-end' : 'dim'}`}>
                {m.dir === 'out' && m.status === 'held' && <><Clock size={9} /> under review · </>}
                {m.time}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-3 pb-3 pt-1">

        {/* State hint above input */}
        {outgoing.kind === 'blocked' && (
          <div className="flex items-center gap-1.5 px-1 pb-1.5 slide-up">
            <Lock size={11} style={{ color: '#f43f5e' }} />
            <span className="text-[11px]" style={{ color: '#f43f5e' }}>
              Can't send — {contact.name} blocks abusive messages
            </span>
          </div>
        )}
        {outgoing.kind === 'review' && (
          <div className="flex items-center gap-1.5 px-1 pb-1.5 slide-up">
            <Clock size={11} style={{ color: '#fbbf24' }} />
            <span className="text-[11px]" style={{ color: '#fbbf24' }}>
              Will go to {contact.name}'s review folder
            </span>
          </div>
        )}

        <div
          className="glass2 flex items-center gap-2 p-1.5"
          style={{
            borderRadius: 999,
            border: outgoing.kind === 'blocked'
              ? '1px solid rgba(244,63,94,0.35)'
              : outgoing.kind === 'review'
              ? '1px solid rgba(251,191,36,0.3)'
              : undefined,
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !sendDisabled && sendOut()}
            placeholder="Message"
            className="flex-1 bg-transparent px-3 text-sm text-main outline-none placeholder:dim"
          />
          <button
            onClick={sendOut}
            disabled={sendDisabled}
            className="grid place-items-center transition-opacity"
            style={{
              width: 38, height: 38, borderRadius: 999,
              background: outgoing.kind === 'blocked'
                ? 'rgba(244,63,94,0.25)'
                : outgoing.kind === 'review'
                ? 'rgba(251,191,36,0.3)'
                : 'linear-gradient(135deg,var(--accent),var(--accent2))',
              opacity: sendDisabled ? 0.45 : 1,
              cursor: sendDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {outgoing.kind === 'checking'
              ? <Loader2 size={16} color="#fff" className="animate-spin" />
              : outgoing.kind === 'blocked'
              ? <Lock size={15} color="#f43f5e" />
              : outgoing.kind === 'review'
              ? <Clock size={15} color="#fbbf24" />
              : <Send size={16} color="#fff" />
            }
          </button>
        </div>
      </div>
    </>
  );
}
