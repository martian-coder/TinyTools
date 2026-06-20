import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Send, Loader2, AlertTriangle, X } from 'lucide-react';
import { useSiftStore, selectConversation } from '../store';
import { Avatar } from '../components/ui/Avatar';
import { getModerator } from '../moderation';
import type { ModerationVerdict } from '../types';

type OutgoingBlock = { text: string; verdict: ModerationVerdict };

export function Conversation() {
  const activeContactId = useSiftStore(s => s.activeContactId);
  const contacts        = useSiftStore(s => s.contacts);
  const settings        = useSiftStore(s => s.settings);
  const setScreen       = useSiftStore(s => s.setScreen);
  const sendMessage     = useSiftStore(s => s.sendMessage);
  const messages        = useSiftStore(s => activeContactId ? selectConversation(s, activeContactId) : []);

  const [draft, setDraft]           = useState('');
  const [checking, setChecking]     = useState(false);
  const [blocked, setBlocked]       = useState<OutgoingBlock | null>(null);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  const contact = contacts.find(c => c.id === activeContactId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!contact) return null;

  const dispatchSend = (text: string) => {
    if (!activeContactId) return;
    sendMessage(activeContactId, text);
    setDraft('');
    setBlocked(null);
  };

  const sendOut = async () => {
    const text = draft.trim();
    if (!text || !activeContactId) return;

    // Only check outgoing if civility filter is on and sensitivity is medium or high
    const { civility } = settings;
    if (!civility.enabled || civility.sensitivity === 'low') {
      dispatchSend(text);
      return;
    }

    setChecking(true);
    try {
      const mod     = await getModerator();
      const verdict = await mod.classify(text, { sensitivity: civility.sensitivity });
      if (verdict.category === 'abusive' || verdict.category === 'spam') {
        setBlocked({ text, verdict });
      } else {
        dispatchSend(text);
      }
    } catch {
      // If classification fails, let the message through
      dispatchSend(text);
    } finally {
      setChecking(false);
    }
  };

  const dismiss = () => {
    setBlocked(null);
    inputRef.current?.focus();
  };

  const sensitivity = settings.civility.sensitivity;
  const isHigh      = sensitivity === 'high';

  return (
    <>
      {/* Header */}
      <div className="glass-h px-3 py-3 flex items-center gap-3">
        <button onClick={() => setScreen('chats')} className="text-main"><ArrowLeft size={20} /></button>
        <Avatar name={contact.name} grad={contact.grad} size={36} trusted={contact.trusted} />
        <div className="flex-1">
          <div className="font-semibold text-main leading-tight">{contact.name}</div>
          {contact.trusted && (
            <div className="text-[11px] flex items-center gap-1 accent-t">
              <ShieldCheck size={11} /> Trusted · filters off
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-24 no-bar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.dir === 'out' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] px-3.5 py-2 text-sm pop ${m.dir === 'out' ? 'bubble-out' : 'bubble-in text-main'}`}
              style={{
                borderRadius: 18,
                borderBottomRightRadius: m.dir === 'out' ? 6 : 18,
                borderBottomLeftRadius:  m.dir === 'out' ? 18 : 6,
              }}
            >
              {m.text}
              <div className={`text-[10px] mt-0.5 ${m.dir === 'out' ? 'out-time' : 'dim'}`}>{m.time}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Outgoing civility warning */}
      {blocked && (
        <div
          className="mx-3 mb-2 p-3 slide-up"
          style={{
            borderRadius: 16,
            background: isHigh ? 'rgba(244,63,94,0.12)' : 'rgba(251,191,36,0.10)',
            border: `1px solid ${isHigh ? 'rgba(244,63,94,0.3)' : 'rgba(251,191,36,0.25)'}`,
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} style={{ color: isHigh ? '#f43f5e' : '#fbbf24', flexShrink: 0, marginTop: 2 }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-main mb-0.5">
                {isHigh ? 'Message blocked' : 'This may be too harsh'}
              </div>
              <div className="text-[11px] dim leading-relaxed">
                {isHigh
                  ? 'This contact has a high civility filter. Your message was flagged as potentially abusive and was not sent.'
                  : 'This contact filters sensitive messages. Your message was flagged — they may not receive it.'}
                {blocked.verdict.reason && (
                  <span className="block mt-0.5 italic">{blocked.verdict.reason}</span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => dispatchSend(blocked.text)}
                  className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: isHigh ? 'rgba(244,63,94,0.15)' : 'rgba(251,191,36,0.12)',
                    color: isHigh ? '#f43f5e' : '#fbbf24',
                  }}
                >
                  Send anyway
                </button>
                <button
                  onClick={dismiss}
                  className="text-[11px] px-2.5 py-1 rounded-full font-medium text-main"
                  style={{ background: 'rgba(255,255,255,0.07)' }}
                >
                  Edit message
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="dim shrink-0"><X size={12} /></button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="glass2 flex items-center gap-2 p-1.5" style={{ borderRadius: 999 }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); setBlocked(null); }}
            onKeyDown={e => e.key === 'Enter' && !checking && sendOut()}
            placeholder="Message"
            className="flex-1 bg-transparent px-3 text-sm text-main outline-none placeholder:dim"
          />
          <button
            onClick={sendOut}
            disabled={checking || !draft.trim()}
            className="send-btn grid place-items-center"
            style={{ width: 38, height: 38, borderRadius: 999, opacity: checking ? 0.7 : 1 }}
          >
            {checking
              ? <Loader2 size={16} color="#fff" className="animate-spin" />
              : <Send size={16} color="#fff" />
            }
          </button>
        </div>
      </div>
    </>
  );
}
