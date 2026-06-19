import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Send } from 'lucide-react';
import { useSiftStore, selectConversation } from '../store';
import { Avatar } from '../components/ui/Avatar';

export function Conversation() {
  const activeContactId = useSiftStore(s => s.activeContactId);
  const contacts        = useSiftStore(s => s.contacts);
  const setScreen       = useSiftStore(s => s.setScreen);
  const sendMessage     = useSiftStore(s => s.sendMessage);
  const messages        = useSiftStore(s => activeContactId ? selectConversation(s, activeContactId) : []);

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const contact = contacts.find(c => c.id === activeContactId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!contact) return null;

  const sendOut = () => {
    if (!draft.trim() || !activeContactId) return;
    sendMessage(activeContactId, draft.trim());
    setDraft('');
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

      {/* Input */}
      <div className="px-3 pb-3 pt-1">
        <div className="glass2 flex items-center gap-2 p-1.5" style={{ borderRadius: 999 }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendOut()}
            placeholder="Message"
            className="flex-1 bg-transparent px-3 text-sm text-main outline-none placeholder:dim"
          />
          <button
            onClick={sendOut}
            className="send-btn grid place-items-center"
            style={{ width: 38, height: 38, borderRadius: 999 }}
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>
    </>
  );
}
