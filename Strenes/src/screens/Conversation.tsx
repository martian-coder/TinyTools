import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Send, AlertCircle, Zap, Brain, MessageCircle } from 'lucide-react';
import { useSiftStore, selectConversation } from '../store';
import { Avatar } from '../components/ui/Avatar';
import { analyzeTypingPattern, getDrunkDetectionLevel } from '../moderation/drunk-detection';
import { analyzeTone, getToneColor, getToneEmoji } from '../moderation/tone-analyzer';

export function Conversation() {
  const activeContactId = useSiftStore(s => s.activeContactId);
  const contacts        = useSiftStore(s => s.contacts);
  const setScreen       = useSiftStore(s => s.setScreen);
  const sendMessage     = useSiftStore(s => s.sendMessage);
  const settings        = useSiftStore(s => s.settings);
  const messages        = useSiftStore(s => activeContactId ? selectConversation(s, activeContactId) : []);

  const [draft, setDraft] = useState('');
  const [draftStartTime, setDraftStartTime] = useState(Date.now());
  const [drunkWarning, setDrunkWarning] = useState<'none' | 'mild' | 'moderate' | 'high'>('none' as 'none' | 'mild' | 'moderate' | 'high');
  const [showDrunkWarning, setShowDrunkWarning] = useState(false);
  const [showToneAnalysis, setShowToneAnalysis] = useState(false);
  const [toneResult, setToneResult] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const contact = contacts.find(c => c.id === activeContactId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!contact) return null;

  const checkDrunkMode = () => {
    if (!settings.drunkMode.enabled && !settings.drunkMode.autoDetect) return false;

    const pattern = analyzeTypingPattern(draft, Date.now() - draftStartTime);
    const level = getDrunkDetectionLevel(pattern);
    setDrunkWarning(level);

    const hasWarning = level === 'mild' || level === 'moderate' || level === 'high';

    if (hasWarning && settings.drunkMode.autoDetect) {
      setShowDrunkWarning(true);
      return true;
    }

    if (settings.drunkMode.enabled) {
      return hasWarning;
    }

    return false;
  };

  const sendOut = () => {
    if (!draft.trim() || !activeContactId) return;

    if (checkDrunkMode()) {
      if (settings.drunkMode.action === 'prevent') {
        return;
      }
      if (settings.drunkMode.action === 'warn') {
        setShowDrunkWarning(true);
        return;
      }
    }

    sendMessage(activeContactId, draft.trim());
    setDraft('');
    setDraftStartTime(Date.now());
    setDrunkWarning('none');
    setShowDrunkWarning(false);
  };

  const handleDraftChange = (text: string) => {
    setDraft(text);
    if (settings.drunkMode.autoDetect && text.length > 10) {
      checkDrunkMode();
    }
  };

  const checkTone = () => {
    if (!draft.trim()) return;
    const analysis = analyzeTone(draft);
    setToneResult(analysis);
    setShowToneAnalysis(true);
  };

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

      {/* Drunk Warning */}
      {showDrunkWarning && (drunkWarning === 'mild' || drunkWarning === 'moderate' || drunkWarning === 'high') && (
        <div className="mx-3 mb-2 glass2 p-2 flex items-center gap-2 text-sm" style={{ borderRadius: 12 }}>
          <AlertCircle size={16} className="flex-shrink-0" style={{ color: drunkWarning === 'high' ? '#ef4444' : '#f59e0b' }} />
          <div>
            <div className="font-semibold text-main">Slow down! 🍷</div>
            <div className="dim text-xs">Your typing looks a bit rushed. Take a breath before sending.</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowDrunkWarning(false)} className="text-xs accent-t hover:opacity-80">Got it</button>
              <button onClick={sendOut} className="text-xs" style={{ color: '#ef4444' }}>Send anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* Tone Analysis Result */}
      {showToneAnalysis && toneResult && (
        <div className="mx-3 mb-2 glass2 p-2 flex items-center gap-2 text-sm" style={{ borderRadius: 12, borderColor: getToneColor(toneResult.tone) + '40' }}>
          <MessageCircle size={16} className="flex-shrink-0" style={{ color: getToneColor(toneResult.tone) }} />
          <div className="flex-1">
            <div className="font-semibold text-main">{getToneEmoji(toneResult.tone)} {toneResult.tone.toUpperCase()}</div>
            <div className="dim text-xs">{Math.round(toneResult.confidence * 100)}% confident · {toneResult.mightCauseAnxiety ? '⚠️ might cause anxiety' : '✓ safe to send'}</div>
            {toneResult.suggestion && <div className="text-xs mt-1" style={{ color: getToneColor(toneResult.tone) }}>{toneResult.suggestion}</div>}
            <div className="flex gap-2 mt-1.5">
              <button onClick={() => setShowToneAnalysis(false)} className="text-xs accent-t hover:opacity-80">Close</button>
              {toneResult.mightCauseAnxiety && <button onClick={() => setDraft('')} className="text-xs" style={{ color: getToneColor(toneResult.tone) }}>Clear & rethink</button>}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="glass2 flex items-center gap-2 p-1.5" style={{ borderRadius: 999 }}>
          <input
            value={draft}
            onChange={e => handleDraftChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !showDrunkWarning && sendOut()}
            placeholder="Message"
            className="flex-1 bg-transparent px-3 text-sm text-main outline-none placeholder:dim"
          />
          {settings.toneChecker.enabled && draft.trim().length > 10 && (
            <button
              onClick={checkTone}
              className="grid place-items-center"
              style={{ width: 32, height: 32, borderRadius: 999, opacity: 0.6, transition: 'opacity .2s' }}
            >
              <Brain size={14} className="text-main" />
            </button>
          )}
          {(drunkWarning === 'mild' || drunkWarning === 'moderate' || drunkWarning === 'high') && (
            <Zap size={16} style={{ color: drunkWarning === 'high' ? '#ef4444' : '#f59e0b', marginRight: 4 }} />
          )}
          <button
            onClick={sendOut}
            disabled={showDrunkWarning && settings.drunkMode.action === 'prevent'}
            className="send-btn grid place-items-center disabled:opacity-50"
            style={{ width: 38, height: 38, borderRadius: 999 }}
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    </>
  );
}
