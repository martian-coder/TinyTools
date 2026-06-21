import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ShieldCheck, Send, Loader2, Lock, Clock, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Sparkles, Check, X, Brain, AlertCircle, RefreshCw } from 'lucide-react';
import { useSiftStore } from '../store';
import { Avatar } from '../components/ui/Avatar';
import { getModerator } from '../moderation';
import { checkSpellingWithAI, applySuggestion } from '../moderation/spell-check';
import { analyzeTone } from '../moderation/tone-analyzer';
import { analyzeTypingPattern, getDrunkDetectionLevel } from '../moderation/drunk-detection';
import { suggestReplies } from '../moderation/reply-suggest';
import type { ModerationVerdict, SpellCheckSuggestion, ToneAnalysis } from '../types';
import type { SuggestionResult } from '../moderation/reply-suggest';

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
  // Pull raw messages from store (stable reference via slice), then filter/sort in useMemo
  // to avoid returning new array references from the Zustand selector (causes infinite loop).
  const allMessages = useSiftStore(s => s.messages);
  const messages = useMemo(() =>
    activeContactId
      ? allMessages
          .filter(m => m.contactId === activeContactId && (
            m.dir === 'out' || m.status === 'delivered' || m.status === 'approved'
          ))
          .sort((a, b) => a.ts - b.ts)
      : [],
    [allMessages, activeContactId]
  );

  const [draft, setDraft]                    = useState('');
  const [outgoing, setOutgoing]              = useState<OutgoingState>({ kind: 'idle' });
  const [callState, setCallState]            = useState<CallState>('idle');
  const [muted, setMuted]                    = useState(false);
  const [speaker, setSpeaker]                = useState(false);
  const [callSecs, setCallSecs]              = useState(0);
  const [spellCheckSuggestions, setSpellCheckSuggestions] = useState<SpellCheckSuggestion[]>([]);
  const [pendingSendText, setPendingSendText] = useState<string | null>(null);
  const [drunkWarning, setDrunkWarning]      = useState<'none' | 'mild' | 'moderate' | 'high'>('none');
  const [toneResult, setToneResult]          = useState<ToneAnalysis | null>(null);
  const [showToneAnalysis, setShowToneAnalysis] = useState(false);
  const [draftStartTime, setDraftStartTime]  = useState<number>(0);
  const [suggestions, setSuggestions]        = useState<SuggestionResult | null>(null);
  const [suggestLoading, setSuggestLoading]  = useState(false);
  const suggestKeyRef = useRef<string>('');
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

  // Fetch AI reply suggestions when the latest message is incoming
  const fetchSuggestions = useCallback(async () => {
    if (!settings.aiReplies?.enabled) { setSuggestions(null); return; }
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.dir !== 'in') return;

    // Build a de-dup key so we don't re-fetch for the same message
    const key = `${lastMsg.id}:${settings.aiReplies.anthropicKey.slice(0, 8)}`;
    if (suggestKeyRef.current === key) return;
    suggestKeyRef.current = key;

    setSuggestions(null);
    setSuggestLoading(true);

    const history = messages.slice(-8).map(m => ({
      role: m.dir === 'in' ? 'incoming' as const : 'outgoing' as const,
      text: m.text,
    }));

    const result = await suggestReplies(history, contact?.name ?? 'them', settings.aiReplies.anthropicKey);
    setSuggestions(result);
    setSuggestLoading(false);
  }, [messages, settings.aiReplies, contact?.name]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

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
    const now = Date.now();
    if (!draftStartTime) setDraftStartTime(now);

    setDraft(text);

    if (!text.trim()) {
      setOutgoing({ kind: 'idle' });
      setDrunkWarning('none');
      setToneResult(null);
      setShowToneAnalysis(false);
      return;
    }

    if (settings.drunkMode.enabled && settings.drunkMode.autoDetect && text.length > 10) {
      const typingTime = Math.max(now - draftStartTime, 100);
      const pattern = analyzeTypingPattern(text, typingTime);
      const level = getDrunkDetectionLevel(pattern);
      setDrunkWarning(level);

      if (level !== 'none' && settings.drunkMode.action === 'prevent') {
        setOutgoing({ kind: 'idle' });
        return;
      }
    }

    if (settings.toneChecker.enabled && text.length > 10) {
      const analysis = analyzeTone(text);
      setToneResult(analysis);
    }

    if (!guardActive)  { setOutgoing({ kind: 'idle' }); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => classify(text.trim()), 700);
  };

  const sendOut = async () => {
    const text = draft.trim();
    if (!text || !activeContactId) return;
    if (outgoing.kind === 'blocked' || outgoing.kind === 'checking') return;
    if (drunkWarning !== 'none' && settings.drunkMode.action === 'prevent') return;

    if (settings.spellCheck.enabled && !pendingSendText) {
      setOutgoing({ kind: 'checking' });
      const userMessageHistory = messages
        .filter(m => m.dir === 'out')
        .map(m => m.text)
        .slice(-10);
      const suggestions = await checkSpellingWithAI(text, userMessageHistory);
      setOutgoing({ kind: 'idle' });
      if (suggestions.length > 0) {
        setSpellCheckSuggestions(suggestions);
        setPendingSendText(text);
        return;
      }
    }

    if (outgoing.kind === 'review') {
      sendOutgoingToReview(activeContactId, text, (outgoing as { kind: 'review'; verdict: ModerationVerdict }).verdict);
    } else {
      sendMessage(activeContactId, text);
    }
    setDraft('');
    setOutgoing({ kind: 'idle' });
    setDrunkWarning('none');
    setToneResult(null);
    setShowToneAnalysis(false);
    setDraftStartTime(0);
  };

  const sendWithCorrections = (acceptSuggestions: boolean) => {
    if (!pendingSendText || !activeContactId) return;
    let finalText = pendingSendText;
    if (acceptSuggestions) {
      for (const s of spellCheckSuggestions) {
        finalText = applySuggestion(finalText, s.original, s.suggested);
      }
    }
    if (outgoing.kind === 'review') {
      sendOutgoingToReview(activeContactId, finalText, (outgoing as { kind: 'review'; verdict: ModerationVerdict }).verdict);
    } else {
      sendMessage(activeContactId, finalText);
    }
    setDraft('');
    setOutgoing({ kind: 'idle' });
    setPendingSendText(null);
    setSpellCheckSuggestions([]);
  };

  if (!contact) return null;

  const sendDisabled = !draft.trim() || outgoing.kind === 'blocked' || outgoing.kind === 'checking' || (drunkWarning !== 'none' && settings.drunkMode.action === 'prevent');

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

      {/* AI Reply Suggestions */}
      {settings.aiReplies?.enabled && (suggestLoading || suggestions) && !draft && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={11} style={{ color: 'var(--accent)' }} />
            <span className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
              {suggestions?.engine === 'claude' ? 'Claude AI' : 'On-device AI'} · Suggestions
            </span>
            {!suggestLoading && (
              <button
                onClick={() => { suggestKeyRef.current = ''; fetchSuggestions(); }}
                className="ml-auto"
                style={{ color: 'var(--accent)', opacity: 0.7 }}
              >
                <RefreshCw size={11} />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-bar pb-0.5">
            {suggestLoading ? (
              [1, 2, 3].map(i => (
                <div
                  key={i}
                  className="shrink-0 h-7 rounded-full"
                  style={{ width: 80 + i * 20, background: 'var(--glass)', opacity: 0.5, animation: 'pulse 1.4s ease-in-out infinite' }}
                />
              ))
            ) : suggestions?.replies.map((r, i) => (
              <button
                key={i}
                onClick={() => setDraft(r)}
                className="shrink-0 px-3 py-1 text-xs font-medium text-main glass rounded-full active:scale-95 transition-transform"
                style={{ border: '1px solid var(--border2)' }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* State hint + Input */}
      <div className="px-3 pb-3 pt-1 space-y-2">
        {outgoing.kind === 'blocked' && (
          <div className="flex items-center gap-1.5 px-1 pb-1.5 slide-up">
            <Lock size={11} style={{ color: '#f43f5e' }} />
            <span className="text-[11px]" style={{ color: '#f43f5e' }}>
              Can't send — {contact.name} blocks abusive messages
            </span>
          </div>
        )}
        {drunkWarning !== 'none' && (
          <div className="glass p-2 flex items-center gap-2 slide-up" style={{ borderRadius: 12, borderLeft: '3px solid #f87171' }}>
            <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
            <span className="text-[11px] text-main">
              {drunkWarning === 'mild' && '🍺 Mild drunk typing detected'}
              {drunkWarning === 'moderate' && '🍻 Moderate drunk typing detected'}
              {drunkWarning === 'high' && '🍷 High drunk typing detected'}
              {settings.drunkMode.action === 'prevent' && ' — message blocked'}
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
            onKeyDown={e => e.key === 'Enter' && !sendDisabled && sendOut().catch(() => {})}
            placeholder="Message"
            className="flex-1 bg-transparent px-3 text-sm text-main outline-none placeholder:dim"
          />
          {settings.toneChecker.enabled && draft.length > 10 && (
            <button
              onClick={() => setShowToneAnalysis(true)}
              className="grid place-items-center transition-all active:scale-90"
              style={{ width: 38, height: 38, borderRadius: 999 }}
              title="Analyze tone"
            >
              <Brain size={16} style={{ color: 'var(--accent)' }} />
            </button>
          )}
          <button
            onClick={() => sendOut()}
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

      {/* Tone Analysis Modal */}
      {showToneAnalysis && toneResult && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => setShowToneAnalysis(false)}
        >
          <div
            className="glass p-5 max-w-xs"
            style={{ borderRadius: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Brain size={18} style={{ color: 'var(--accent)' }} />
              <div className="font-semibold text-main">Message Tone</div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs dim mb-1">Detected tone</div>
                <div className="text-sm font-medium text-main capitalize">{toneResult.tone}</div>
              </div>
              <div>
                <div className="text-xs dim mb-1">Confidence</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 glass rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.round(toneResult.confidence * 100)}%`,
                        background: toneResult.confidence > 0.7 ? '#f87171' : toneResult.confidence > 0.5 ? '#fbbf24' : '#22d3ee',
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium">{Math.round(toneResult.confidence * 100)}%</span>
                </div>
              </div>
              {toneResult.mightCauseAnxiety && (
                <div className="p-2 rounded-lg" style={{ background: 'rgba(248, 113, 113, 0.15)', borderLeft: '3px solid #f87171' }}>
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                    <span className="text-xs text-main">This message might upset someone.</span>
                  </div>
                </div>
              )}
              {toneResult.suggestion && (
                <div>
                  <div className="text-xs dim mb-1">Suggestion</div>
                  <div className="text-xs text-main">{toneResult.suggestion}</div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowToneAnalysis(false)}
              className="w-full mt-4 px-3 py-2 text-xs font-medium text-main hover:bg-white hover:bg-opacity-5 transition"
              style={{ borderRadius: 12 }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Spell Check Modal */}
      {pendingSendText && spellCheckSuggestions.length > 0 && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={() => {
            setPendingSendText(null);
            setSpellCheckSuggestions([]);
          }}
        >
          <div
            className="glass p-5 max-w-xs"
            style={{ borderRadius: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-[#fbbf24]" />
              <div className="font-semibold text-main">Style-Aware Corrections</div>
            </div>
            <p className="text-xs dim mb-3">Found {spellCheckSuggestions.length} {spellCheckSuggestions.length === 1 ? 'typo' : 'typos'}:</p>
            <div className="space-y-2 mb-4">
              {spellCheckSuggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="dim">{s.original}</span>
                  <span className="text-[10px] dim">→</span>
                  <span className="text-main font-medium">{s.suggested}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => sendWithCorrections(false)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium dim hover:bg-white hover:bg-opacity-5 transition"
                style={{ borderRadius: 12 }}
              >
                <X size={14} /> Send as-is
              </button>
              <button
                onClick={() => sendWithCorrections(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-main hover:bg-white hover:bg-opacity-10 transition"
                style={{ borderRadius: 12, background: 'rgba(251,191,36,0.15)' }}
              >
                <Check size={14} /> Fix & send
              </button>
            </div>
          </div>
        </div>
      )}

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
