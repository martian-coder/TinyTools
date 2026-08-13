import React, { useState } from 'react';
import { PodcastItem } from '../types';
import { Bot, Send, Sparkles, RefreshCw, User } from 'lucide-react';

interface AIAssistantViewProps {
  podcasts: PodcastItem[];
  onSelectPodcast: (podcast: PodcastItem) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({ podcasts }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'msg-1',
    sender: 'assistant',
    text: `Hi! I'm your AI Podcast Research Assistant with access to all ${podcasts.length} podcasts in your library.\n\nTry asking:\n• "What are all the SaaS monetization models in my library?"\n• "Compare the discipline habits from different episodes."\n• "What ethical dilemmas should I watch out for with AI automation?"`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }]);

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const suggestedPrompts = [
    'Synthesize all B2B SaaS business models',
    'Top 3 discipline habits I can use today',
    'Explain outcome-based vs seat-based pricing',
    'Ethics of AI automation',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`, sender: 'user', text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ podcastContext: podcasts, userMessage: query, history: messages }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Failed to get answer');
      setMessages((prev) => [...prev, {
        id: `bot-${Date.now()}`, sender: 'assistant',
        text: json.reply || 'No answer generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`, sender: 'assistant',
        text: `Sorry, I encountered an error: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[78vh] overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#e6f7f4' }}>
            <Bot className="w-4 h-4" style={{ color: '#11A888' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              AI Assistant
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-teal-50 border border-teal-200" style={{ color: '#11A888' }}>
                Gemini
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Querying across {podcasts.length} podcasts</p>
          </div>
        </div>
        <button
          onClick={() => setMessages([{ id: 'msg-init', sender: 'assistant', text: 'Chat cleared. How can I help?', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])}
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
          title="Clear Conversation"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 shrink-0">
          <Sparkles className="w-3 h-3" style={{ color: '#11A888' }} /> Try:
        </span>
        {suggestedPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            disabled={isSending}
            className="px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 shrink-0 transition-all cursor-pointer text-[11px] font-medium whitespace-nowrap"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4 bg-slate-50/30 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 max-w-2xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
              msg.sender === 'user' ? 'text-white' : 'bg-white border border-slate-200 text-slate-500'
            }`} style={msg.sender === 'user' ? { background: '#11A888' } : {}}>
              {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed space-y-1 ${
              msg.sender === 'user'
                ? 'text-white rounded-tr-sm'
                : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm whitespace-pre-line'
            }`} style={msg.sender === 'user' ? { background: '#11A888' } : {}}>
              <div>{msg.text}</div>
              <div className={`text-[10px] text-right ${msg.sender === 'user' ? 'text-white/60' : 'text-slate-400'}`}>
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex gap-2.5 mr-auto max-w-xs">
            <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            </div>
            <div className="px-4 py-3 bg-white border border-slate-200 rounded-xl rounded-tl-sm text-xs text-slate-500 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: '#11A888' }} />
              <span>Analyzing your podcasts…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask anything across your podcast library…"
          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isSending}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          style={{ background: '#11A888' }}
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
};
