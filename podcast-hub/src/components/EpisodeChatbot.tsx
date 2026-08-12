import React, { useState, useRef, useEffect } from 'react';
import { PodcastItem } from '../types';
import {
  Bot,
  Send,
  User,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Lightbulb,
  FileText,
  Code,
  ShieldCheck,
  HelpCircle,
  Loader2,
  Brain,
  Maximize2,
  Minimize2,
  Columns,
  Rows,
} from 'lucide-react';

interface EpisodeChatbotProps {
  podcast: PodcastItem;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  layoutMode?: 'split' | 'stacked' | 'full';
  onLayoutModeChange?: (mode: 'split' | 'stacked' | 'full') => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const EpisodeChatbot: React.FC<EpisodeChatbotProps> = ({
  podcast,
  isExpanded,
  onToggleExpand,
  layoutMode = 'split',
  onLayoutModeChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: `👋 **Welcome! I'm your AI Research & Brainstorm Assistant for this video episode.**\n\nI have indexed the full summary, key takeaways, monetization opportunities, and timestamps for **"${podcast.title}"**.\n\nAsk me anything! You can research specific concepts, request code blueprints, draft tweet threads, or brainstorm business models like ChatGPT.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const promptSuggestions = [
    {
      label: '💡 Brainstorm 3 Micro-SaaS Ideas',
      prompt: `Based on the video "${podcast.title}", brainstorm 3 realistic micro-SaaS or agency startup ideas. Include target audience, pricing model, and step-by-step MVP plan.`,
    },
    {
      label: '📝 Draft Viral Twitter/X Thread',
      prompt: `Write a compelling, high-converting 6-tweet thread summarizing the most valuable insights from "${podcast.title}". Include hooks and emojis.`,
    },
    {
      label: '🎯 5 Actionable Implementation Steps',
      prompt: `List 5 concrete, step-by-step actions a solo developer or entrepreneur can take this week based on the concepts in this episode.`,
    },
    {
      label: '⚡ Deep Dive on Monetization',
      prompt: `Explain the monetization opportunities mentioned in this episode in detail. What are the key execution risks and how can they be mitigated?`,
    },
    {
      label: '⚖️ Ethical Risks & Discipline Checklist',
      prompt: `Summarize the ethical considerations and personal focus discipline habits discussed in this episode.`,
    },
  ];

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputValue;
    if (!textToSend.trim() || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: textToSend.trim(),
          podcastContext: {
            title: podcast.title,
            channel: podcast.channel,
            duration: podcast.duration,
            shortSummary: podcast.shortSummary,
            detailedSummary: podcast.detailedSummary,
            monetizationOpportunities: podcast.monetizationOpportunities,
            ethicsAndDiscipline: podcast.ethicsAndDiscipline,
            keyTimestamps: podcast.keyTimestamps,
            userNotes: podcast.userNotes,
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.reply) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(data.error || 'Failed to get AI reply');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Error generating AI response:** ${err.message || 'Please check your connection and try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        sender: 'assistant',
        text: `Chat session reset! Ready for new brainstorming & research questions about **"${podcast.title}"**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col h-[580px] sm:h-[620px] transition-all duration-300">
      {/* Header */}
      <div className="bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-5 py-3 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">AI Brainstorm Bot</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Gemini 3.6
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {podcast.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Expand / Layout Mode Controls */}
          {onLayoutModeChange && (
            <div className="flex items-center bg-slate-200/60 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-300/50 dark:border-slate-700/50">
              <button
                onClick={() => onLayoutModeChange('split')}
                title="Side-by-Side Split View (Watch & Chat)"
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  layoutMode === 'split'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onLayoutModeChange('stacked')}
                title="Bring Down / Stack Full Width"
                className={`p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  layoutMode === 'stacked'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Rows className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              title={isExpanded ? 'Collapse Chatbot' : 'Expand Chatbot Below Video'}
              className="p-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer text-xs flex items-center gap-1 border border-slate-300/50 dark:border-slate-700/50"
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[11px] font-semibold">{isExpanded ? 'Minimize' : 'Expand'}</span>
            </button>
          )}

          <button
            onClick={handleResetChat}
            title="Reset Conversation"
            className="p-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer text-xs flex items-center gap-1 border border-slate-300/50 dark:border-slate-700/50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Chat Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 max-w-3xl ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-indigo-600'
                  : 'bg-gradient-to-br from-violet-600 to-indigo-700 border border-indigo-400/30'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            {/* Bubble */}
            <div
              className={`group relative rounded-2xl p-3.5 text-xs leading-relaxed transition-all ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm'
              }`}
            >
              {/* Copy Button for Assistant */}
              {msg.sender === 'assistant' && (
                <button
                  onClick={() => handleCopyText(msg.id, msg.text)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-800 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Copy text"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}

              <div className="whitespace-pre-wrap space-y-2">
                {msg.text.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx}>
                    {paragraph.split('**').map((part, bIdx) =>
                      bIdx % 2 === 1 ? (
                        <strong key={bIdx} className="font-bold text-indigo-600 dark:text-indigo-300">
                          {part}
                        </strong>
                      ) : (
                        part
                      )
                    )}
                  </p>
                ))}
              </div>

              <div
                className={`mt-1.5 text-[9px] text-right font-mono ${
                  msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 max-w-xl mr-auto">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white shrink-0">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Analyzing episode context & synthesizing ideas...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="bg-slate-100/80 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800/80 px-3.5 py-2 overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1 uppercase tracking-wide">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Quick Ideas:
        </span>
        {promptSuggestions.map((item, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSendMessage(item.prompt)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-600/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-200 border border-slate-200 dark:border-slate-700/60 hover:border-indigo-400 transition-all whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50 shadow-sm"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask research questions or brainstorm from episode...`}
            disabled={isLoading}
            className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 shadow-inner"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <Send className="w-3 h-3" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
