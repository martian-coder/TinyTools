import React, { useState } from 'react';
import { PodcastItem } from '../types';
import {
  Bot,
  Send,
  Sparkles,
  Search,
  BookOpen,
  Lightbulb,
  ShieldCheck,
  User,
  RefreshCw,
} from 'lucide-react';

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

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  podcasts,
  onSelectPodcast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      text: `Hello! I am your AI Podcast Learning & Monetization Mentor. I have full semantic index access across all ${podcasts.length} podcasts in your library.\n\nAsk me anything! For example:\n- *"What are all the micro-SaaS and B2B monetization models in my library?"*\n- *"Compare the discipline habits discussed by Huberman vs Andrew Carnegie."*\n- *"What ethical dilemmas should I watch out for when automating work with AI agents?"*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const suggestedPrompts = [
    'Synthesize all B2B SaaS business models across my podcasts',
    'What are the top 3 discipline habits I can implement today?',
    'Explain outcome-based pricing vs seat-based pricing',
    'Summarize the ethical considerations around AI automation',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputMessage;
    if (!query.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podcastContext: podcasts,
          userMessage: query,
          history: messages,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to get answer from AI mentor');
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: json.reply || 'No answer generated.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Sorry, I encountered an error searching across your podcasts: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col h-[75vh] overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 via-indigo-600 to-blue-600 p-0.5 shadow-sm">
            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-600 dark:text-amber-400" />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              AI Multi-Podcast Search & Assistant
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 font-semibold">
                Gemini AI Engine
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Query across all {podcasts.length} podcast summaries, transcripts & business blueprints
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            setMessages([
              {
                id: 'msg-init',
                sender: 'assistant',
                text: 'Chat history cleared. How can I assist your podcast research now?',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ])
          }
          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
          title="Clear Conversation"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Suggestion Chips */}
      <div className="p-3 bg-slate-100/60 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0 font-medium text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-amber-400" /> Prompts:
        </span>
        {suggestedPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            disabled={isSending}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white shrink-0 transition-all cursor-pointer text-[11px] font-medium shadow-xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-slate-900/40">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-3xl ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-semibold ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed space-y-2 ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm'
                  : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-xs whitespace-pre-line'
              }`}
            >
              <div>{msg.text}</div>
              <div
                className={`text-[10px] text-right font-mono ${
                  msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex gap-3 mr-auto max-w-xl">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2 shadow-xs">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Scanning podcast library & synthesizing analysis...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Field */}
      <div className="p-4 bg-slate-50/90 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask AI across all podcasts (e.g. 'What SaaS ideas exist for healthcare?')..."
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-inner"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isSending}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 sm:px-5 sm:py-2.5 rounded-2xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
};
