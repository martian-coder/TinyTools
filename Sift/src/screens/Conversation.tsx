import { useState, useRef, useEffect } from 'react';
import { useSiftStore, selectConversation } from '../store';
import { Glass } from '../components/ui/Glass';
import { Avatar } from '../components/ui/Avatar';
import { CategoryBadge } from '../components/ui/Badge';

export function Conversation() {
  const activeContactId = useSiftStore(s => s.activeContactId);
  const contacts = useSiftStore(s => s.contacts);
  const setScreen = useSiftStore(s => s.setScreen);
  const sendMessage = useSiftStore(s => s.sendMessage);
  const messages = useSiftStore(s =>
    activeContactId ? selectConversation(s, activeContactId) : []
  );

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const contact = contacts.find(c => c.id === activeContactId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!contact) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || !activeContactId) return;
    sendMessage(activeContactId, text);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Glass
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setScreen('chats')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 22,
            cursor: 'pointer',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ‹
        </button>
        <Avatar name={contact.name} grad={contact.grad} size={38} trusted={contact.trusted} />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 16 }}>{contact.name}</div>
          {contact.trusted && (
            <div style={{ color: '#34d399', fontSize: 11, fontWeight: 500 }}>✓ Trusted contact</div>
          )}
        </div>
      </Glass>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map(msg => {
          const isOut = msg.dir === 'out';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isOut ? 'flex-end' : 'flex-start',
                animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
              }}
            >
              <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: isOut ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    background: isOut ? 'var(--bubble-out)' : 'var(--bubble)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border)',
                    borderRadius: isOut ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    padding: '10px 14px',
                    color: 'var(--text)',
                    fontSize: 14,
                    lineHeight: 1.45,
                  }}
                >
                  {msg.text}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{msg.time}</span>
                  {isOut && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>✓✓</span>}
                  {msg.verdict && msg.verdict.category !== 'clean' && !isOut && (
                    <CategoryBadge category={msg.verdict.category} size="sm" />
                  )}
                  {msg.status === 'approved' && (
                    <span style={{ color: '#34d399', fontSize: 10 }}>✓ Approved</span>
                  )}
                </div>
                {msg.autoReply && !isOut && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--accent)',
                      background: 'rgba(124,131,255,0.1)',
                      border: '1px solid rgba(124,131,255,0.2)',
                      borderRadius: 8,
                      padding: '4px 8px',
                    }}
                  >
                    🤖 Auto-reply sent to sender
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '10px 14px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border)',
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          flexShrink: 0,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type a message…"
          style={{
            flex: 1,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 22,
            padding: '10px 16px',
            color: 'var(--text)',
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: 'none',
            background: input.trim()
              ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
              : 'var(--surface-strong)',
            color: '#fff',
            fontSize: 18,
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            flexShrink: 0,
            boxShadow: input.trim() ? '0 0 16px var(--accent)44' : 'none',
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
