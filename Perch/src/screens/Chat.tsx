import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { usePerch, uid } from '../store';
import { askPerch } from '../ai/analyst';
import { providerLabel } from '../ai/cloud';
import { OwlLogo } from '../components/OwlLogo';

const SUGGESTIONS = [
  'Anything I should worry about this week?',
  'Who triggered flags?',
  'What happened today?',
];

export function Chat() {
  const { chat, events, kidAlias, apiKey } = usePerch();
  const addChat = usePerch(s => s.addChat);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setDraft('');
    addChat({ id: uid(), role: 'parent', text: q, at: Date.now() });
    setBusy(true);
    try {
      const answer = await askPerch(q, events, kidAlias, apiKey);
      addChat({ id: uid(), role: 'perch', text: answer, at: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2.5 px-4 pb-2 pt-5">
        <OwlLogo size={36} />
        <div>
          <h1 className="text-[17px] font-extrabold" style={{ color: 'var(--accent)' }}>Ask Perch</h1>
          <p className="text-[10.5px]" style={{ color: 'var(--dim)' }}>{providerLabel(apiKey)} · answers from the flag log only</p>
        </div>
      </header>

      <div className="scroll-y flex-1 px-4">
        {chat.length === 0 && (
          <p className="pt-8 text-center text-[13px]" style={{ color: 'var(--dim)' }}>
            Ask me what's been happening on {kidAlias || 'the protected'}'s phone.
          </p>
        )}
        <div className="flex flex-col gap-2.5 pb-3">
          {chat.map(m => (
            <div
              key={m.id}
              className={`rise max-w-[85%] whitespace-pre-line rounded-3xl px-4 py-3 text-[13.5px] leading-relaxed ${
                m.role === 'parent' ? 'self-end rounded-br-lg' : 'self-start rounded-bl-lg'
              }`}
              style={
                m.role === 'parent'
                  ? { background: 'var(--accent)', color: '#1a1206' }
                  : { background: 'var(--glass)', border: '1px solid var(--line)' }
              }
            >
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="pulse-soft self-start rounded-3xl rounded-bl-lg px-4 py-3 text-[13.5px]"
              style={{ background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--dim)' }}>
              Perch is thinking… 🦉
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {chat.length < 2 && (
        <div className="scroll-y flex gap-2 overflow-x-auto px-4 pb-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="shrink-0 rounded-full px-3.5 py-2 text-[12px] font-medium"
              style={{ background: 'var(--glass2)', border: '1px solid var(--line)', color: 'var(--text)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pb-1">
        <div className="glass flex items-center gap-2 rounded-3xl py-1.5 pl-4 pr-1.5">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(draft); }}
            placeholder="Ask Perch anything…"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: 'var(--text)' }}
          />
          <button
            onClick={() => send(draft)}
            disabled={busy || !draft.trim()}
            className="grid h-10 w-10 place-items-center rounded-full transition active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#1a1206' }}
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
