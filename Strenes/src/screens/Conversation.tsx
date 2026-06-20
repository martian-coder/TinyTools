import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ShieldCheck, Send, Loader2, Lock, Clock, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
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

type CallState = 'idle' | 'ringing' | 'connected';

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

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
  const [callState, setCallState] = useState<CallState>('idle');
  const [muted, setMuted]         = useState(false);
  const [speaker, setSpeaker]     = useState(false);
  const [callSecs, setCallSecs]   = useState(0);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  const contact      = contacts.find(c => c.id === activeContactId);
  const { civility } = settings;
  const guardActive  = civility.enabled && civility.sensitivity !== 'low';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Call timer
  useEffect(() => {
    if (callState === 'connected') {
      setCallSecs(0);
      timerRef.current = setInterval(() => setCallSecs(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const startCall = () => {
    setCallState('ringing');
    setMuted(false);
    setSpeaker(false);
    setTimeout(() => setCallState(prev => prev === 'ringing' ? 'connected' : prev), 2500);
  };

  const endCall = () => {
    setCallState('idle');
    setCallSecs(0);
  };

  // Debounced live classification
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
        setOutgoing({ kind: 'review', verdict });
      }
    } catch {
      setOutgoing({ kind: 'clean' });
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
    if (outgoing.kind === 'blocked' || outgoing.kind === 'checking') return;
    if (outgoing.kind === 'review') {
      sendOutgoingToReview(activeContactId, text, (outgoing as { kind: 'review'; verdict: ModerationVerdict }).verdict);
    } else {
      sendMessage(activeContactId, text);
    }
    setDraft('');
    setOutgoing({ kind: 'idle' });
  };

  if (!contact) return null;

  const sendDisabled = !draft.trim() || outgoing.kind === 'blocked' || outgoing.kind === 'checking';

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
        <button
          onClick={startCall}
          className="grid place-items-center transition-all active:scale-90"
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
            boxShadow: '0 6px 18px -6px var(--accent)',
          }}
        >
          <Phone size={16} color="#fff" />
        </button>
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

      {/* State hint + Input */}
      <div className="px-3 pb-3 pt-1">
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

      {/* In-call overlay */}
      {callState !== 'idle' && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-between py-14 slide-up"
          style={{ background: 'rgba(11,16,32,0.92)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)' }}
        >
          {/* Contact info */}
          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="relative grid place-items-center">
              {callState === 'ringing' && (
                <>
                  <div className="absolute rounded-full" style={{ width: 120, height: 120, background: 'var(--accent)', opacity: 0.12, animation: 'pulse 1.4s ease-in-out infinite' }} />
                  <div className="absolute rounded-full" style={{ width: 100, height: 100, background: 'var(--accent)', opacity: 0.18, animation: 'pulse 1.4s ease-in-out infinite .35s' }} />
                </>
              )}
              <div style={{ width: 80, height: 80, borderRadius: 999, overflow: 'hidden', border: '3px solid var(--accent)', boxShadow: '0 0 32px -8px var(--accent)' }}>
                <Avatar name={contact.name} grad={contact.grad} size={80} />
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-main tracking-tight">{contact.name}</div>
              <div className="text-sm mt-1 font-medium" style={{ color: 'var(--accent)' }}>
                {callState === 'ringing' ? 'Calling…' : formatDuration(callSecs)}
              </div>
            </div>
          </div>

          {/* Call controls */}
          <div className="flex items-end gap-6">
            <button onClick={() => setMuted(m => !m)} className="flex flex-col items-center gap-2">
              <div className="grid place-items-center" style={{
                width: 56, height: 56, borderRadius: 999,
                background: muted ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.09)',
                border: `1px solid ${muted ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.15)'}`,
              }}>
                {muted ? <MicOff size={22} color="#f43f5e" /> : <Mic size={22} color="#fff" />}
              </div>
              <span className="text-[11px] dim">{muted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button onClick={endCall} className="flex flex-col items-center gap-2">
              <div className="grid place-items-center" style={{
                width: 68, height: 68, borderRadius: 999,
                background: 'linear-gradient(135deg,#f43f5e,#e11d48)',
                boxShadow: '0 12px 32px -10px rgba(244,63,94,.7)',
              }}>
                <PhoneOff size={26} color="#fff" />
              </div>
              <span className="text-[11px] dim">End</span>
            </button>

            <button onClick={() => setSpeaker(s => !s)} className="flex flex-col items-center gap-2">
              <div className="grid place-items-center" style={{
                width: 56, height: 56, borderRadius: 999,
                background: speaker ? 'rgba(124,131,255,0.2)' : 'rgba(255,255,255,0.09)',
                border: `1px solid ${speaker ? 'rgba(124,131,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
              }}>
                {speaker ? <Volume2 size={22} color="var(--accent)" /> : <VolumeX size={22} color="#fff" />}
              </div>
              <span className="text-[11px] dim">Speaker</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
