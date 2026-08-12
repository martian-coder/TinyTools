import React, { useState } from 'react';
import { PodcastItem, ReflectionQuestion, DeepFocusResult } from '../types';
import { EmbeddedYouTubePlayer } from './EmbeddedYouTubePlayer';
import { EpisodeChatbot } from './EpisodeChatbot';
import {
  ArrowLeft,
  Clock,
  BookOpen,
  Lightbulb,
  ShieldCheck,
  HelpCircle,
  FileText,
  Bookmark,
  Share2,
  Copy,
  Download,
  Check,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Target,
  Send,
  Zap,
  Tv,
  Bot,
  Heart,
} from 'lucide-react';

interface PodcastDetailViewProps {
  podcast: PodcastItem;
  onBack: () => void;
  onUpdatePodcast: (updated: PodcastItem) => void;
  onToggleFavorite?: (id: string) => void;
}

export const PodcastDetailView: React.FC<PodcastDetailViewProps> = ({
  podcast,
  onBack,
  onUpdatePodcast,
  onToggleFavorite,
}) => {
  const [activeTab, setActiveTab] = useState<
    'summary' | 'monetization' | 'ethics' | 'questions' | 'timestamps' | 'notes' | 'chatbot'
  >('chatbot');

  const [detailLayout, setDetailLayout] = useState<'split' | 'stacked' | 'full'>('split');
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({ 0: true });
  const [copiedNote, setCopiedNote] = useState(false);
  const [userNotesText, setUserNotesText] = useState(podcast.userNotes || '');
  const [showVideoPlayer, setShowVideoPlayer] = useState(true);

  // Deep focus state
  const [selectedTimestampRange, setSelectedTimestampRange] = useState<string>('00:00 - 15:00');
  const [deepFocusResult, setDeepFocusResult] = useState<DeepFocusResult | null>(null);
  const [isFocusing, setIsFocusing] = useState(false);

  // Reflection questions user state
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [showAnswerHints, setShowAnswerHints] = useState<Record<string, boolean>>({});

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleNotesChange = (text: string) => {
    setUserNotesText(text);
    onUpdatePodcast({ ...podcast, userNotes: text });
  };

  const handleCopyNotes = () => {
    const fullContent = `
# ${podcast.title}
Source: ${podcast.source}
Channel: ${podcast.channel}

## Executive Short Summary
${podcast.shortSummary}

## Key Actionable Takeaways
${podcast.actionableTakeaways.map((a) => `- ${a}`).join('\n')}

## Monetization Opportunities
${podcast.monetizationOpportunities
  .map(
    (m) =>
      `### ${m.title}\nModel: ${m.model}\nPotential Revenue: ${m.potentialRevenue}\nDifficulty: ${m.difficulty}\nSteps:\n${m.actionSteps
        .map((s) => `  - ${s}`)
        .join('\n')}`
  )
  .join('\n\n')}

## User Study Notes
${userNotesText}
`;

    navigator.clipboard.writeText(fullContent);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(podcast, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${podcast.title.replace(/[^a-z0-9]/gi, '_')}_summary.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDeepFocusAnalysis = async (timestampStr: string) => {
    setSelectedTimestampRange(timestampStr);
    setIsFocusing(true);
    try {
      const response = await fetch('/api/timestamp-focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podcastTitle: podcast.title,
          timestampRange: timestampStr,
          transcriptSnippet: podcast.shortSummary,
          focusGoal: 'Deep dive analysis, quotes, business plan, and ethics assessment.',
        }),
      });
      const json = await response.json();
      if (json.success && json.data) {
        setDeepFocusResult(json.data);
      }
    } catch (err) {
      console.error('Timestamp focus error:', err);
    } finally {
      setIsFocusing(false);
    }
  };

  const handleAnswerSubmit = (qId: string, selectedOption: string) => {
    setQuestionAnswers((prev) => ({ ...prev, [qId]: selectedOption }));
    // Increment mastery level
    const updatedMastery = Math.min(100, podcast.masteryLevel + 10);
    onUpdatePodcast({ ...podcast, masteryLevel: updatedMastery });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(podcast.id)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  podcast.isFavorite
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${podcast.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span>{podcast.isFavorite ? 'Favorited' : 'Favorite'}</span>
              </button>
            )}

            {/* Layout Toggle Buttons when Video is active */}
            {showVideoPlayer && activeTab === 'chatbot' && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl p-0.5 border border-slate-200 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setDetailLayout('split')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    detailLayout === 'split'
                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Watch & Chat Side-by-Side Split View"
                >
                  <Bot className="w-3 h-3" />
                  <span>Side-by-Side</span>
                </button>

                <button
                  onClick={() => setDetailLayout('stacked')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    detailLayout === 'stacked'
                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Expand Chatbot Below Video"
                >
                  <span>Expand Chat</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveTab('chatbot')}
              className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-3.5 py-1.5 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Chatbot</span>
            </button>

            <button
              onClick={() => setShowVideoPlayer(!showVideoPlayer)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                showVideoPlayer
                  ? 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5 text-red-500" />
              <span>{showVideoPlayer ? 'Hide Video' : 'Watch Video'}</span>
            </button>

            <button
              onClick={handleCopyNotes}
              className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-sm"
            >
              {copiedNote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedNote ? 'Copied Markdown!' : 'Copy Summary'}</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Title & Info */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 font-bold">
              {podcast.channel}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {podcast.duration}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Added {podcast.dateAdded}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
            {podcast.title}
          </h1>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {podcast.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* SIDE-BY-SIDE WATCH & CHAT LAYOUT OR STACKED LAYOUT */}
      {showVideoPlayer && activeTab === 'chatbot' && detailLayout === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
          {/* Left: YouTube Video Player */}
          <div className="lg:col-span-7 space-y-4">
            <EmbeddedYouTubePlayer
              sourceUrlOrId={podcast.youtubeVideoId || podcast.source}
              title={podcast.title}
              channel={podcast.channel}
              keyTimestamps={podcast.keyTimestamps}
              onBookmarkTimestamp={(ts, topic) => {
                const newNotes = `${userNotesText}\n- [Bookmarked Clip ${ts}] ${topic}`;
                handleNotesChange(newNotes);
              }}
            />
          </div>

          {/* Right: AI Research & Brainstorm Chatbot */}
          <div className="lg:col-span-5 space-y-4">
            <EpisodeChatbot
              podcast={podcast}
              layoutMode="split"
              onLayoutModeChange={(mode) => setDetailLayout(mode)}
              isExpanded={false}
              onToggleExpand={() => setDetailLayout('stacked')}
            />
          </div>
        </div>
      ) : (
        /* STACKED VIDEO PLAYER (If Video enabled) */
        showVideoPlayer && (
          <EmbeddedYouTubePlayer
            sourceUrlOrId={podcast.youtubeVideoId || podcast.source}
            title={podcast.title}
            channel={podcast.channel}
            keyTimestamps={podcast.keyTimestamps}
            onBookmarkTimestamp={(ts, topic) => {
              const newNotes = `${userNotesText}\n- [Bookmarked Clip ${ts}] ${topic}`;
              handleNotesChange(newNotes);
            }}
          />
        )
      )}

      {/* Sub-Navigation Segmented Pill Tabs */}
      <div className="bg-slate-200/50 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-300/60 dark:border-slate-800/80 backdrop-blur-md flex items-center gap-1 overflow-x-auto scrollbar-none text-xs sm:text-sm font-medium shadow-inner">
        <button
          onClick={() => setActiveTab('chatbot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'chatbot'
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 font-bold'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Bot className="w-4 h-4 text-indigo-400" />
          <span>🧠 AI Brainstorm Bot</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'summary'
              ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-sm font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Summary</span>
        </button>

        <button
          onClick={() => setActiveTab('monetization')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'monetization'
              ? 'bg-white dark:bg-amber-600 text-amber-700 dark:text-white shadow-sm font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span>Monetization ({podcast.monetizationOpportunities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ethics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ethics'
              ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-sm font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Ethics & Discipline</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'questions'
              ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-sm font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-purple-500" />
          <span>Quiz ({podcast.reflectionQuestions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('timestamps')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'timestamps'
              ? 'bg-white dark:bg-cyan-600 text-cyan-700 dark:text-white shadow-sm font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 text-cyan-500" />
          <span>Timestamps</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'notes'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Journal</span>
        </button>
      </div>

      {/* TAB 0: EPISODE AI CHATBOT (Only in stacked mode or when user clicks tab directly) */}
      {activeTab === 'chatbot' && (detailLayout === 'stacked' || !showVideoPlayer) && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <EpisodeChatbot
            podcast={podcast}
            layoutMode="stacked"
            onLayoutModeChange={(mode) => setDetailLayout(mode)}
            isExpanded={true}
            onToggleExpand={() => setDetailLayout('split')}
          />
        </div>
      )}

      {/* TAB 1: SHORT & DETAILED SUMMARY */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Executive Short Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-2.5 text-indigo-400 border-b border-slate-800/80 pb-3">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">Executive Short Summary</h2>
            </div>
            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {podcast.shortSummary}
            </div>
          </div>

          {/* Actionable Takeaways */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-400" />
              Core Actionable Takeaways
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-200">
              {podcast.actionableTakeaways.map((item, idx) => (
                <li
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Detailed Summary Breakdown */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Detailed Breakdown by Section
            </h3>

            {podcast.detailedSummary.map((sec, idx) => {
              const isOpen = expandedSections[idx];
              return (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleSection(idx)}
                    className="w-full px-5 py-4 bg-slate-950/60 hover:bg-slate-950 flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {sec.timestampRange || `Section ${idx + 1}`}
                        </span>
                        <h4 className="text-sm font-bold text-white">{sec.sectionTitle}</h4>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="p-5 space-y-4 border-t border-slate-800 text-xs sm:text-sm text-slate-300">
                      <p className="leading-relaxed">{sec.content}</p>

                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 space-y-2">
                        <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Key Bullet Insights
                        </h5>
                        <ul className="space-y-1.5 text-slate-200">
                          {sec.keyPoints.map((kp, kIdx) => (
                            <li key={kIdx} className="flex items-start gap-2">
                              <span className="text-indigo-400 font-bold">•</span>
                              <span>{kp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MONETIZATION & BUSINESS OPPORTUNITIES */}
      {activeTab === 'monetization' && (
        <div className="space-y-6">
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-6 space-y-2">
            <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Monetization & Business Ideas Extracted
            </h2>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              These revenue models, SaaS concepts, and business ideas were derived directly from the podcast discussions. You can use these blueprints to build products, micro-agencies, or services.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {podcast.monetizationOpportunities.map((opp) => (
              <div
                key={opp.id}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {opp.model}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        opp.difficulty === 'Easy'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : opp.difficulty === 'Medium'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-red-500/20 text-red-300 border-red-500/30'
                      }`}
                    >
                      {opp.difficulty} Execution
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white leading-snug">{opp.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{opp.description}</p>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Potential Revenue:</span>
                    <span className="font-bold text-emerald-400 font-mono">{opp.potentialRevenue}</span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Step-by-Step Action Plan
                    </h4>
                    <ol className="space-y-1.5 text-xs text-slate-300">
                      {opp.actionSteps.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {sIdx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleNotesChange(
                      `${userNotesText}\n\n### [Saved Monetization Idea] ${opp.title}\n${opp.description}\nRevenue: ${opp.potentialRevenue}`
                    );
                    alert('Saved this business idea into your Journal notes!');
                  }}
                  className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 rounded-xl border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Save to My Notes</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ETHICS & DISCIPLINE */}
      {activeTab === 'ethics' && (
        <div className="space-y-6">
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-6 space-y-2">
            <h2 className="text-lg font-bold text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Ethics, Discipline & Mindset Insights
            </h2>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              Critical discussions regarding personal work discipline, philosophical frameworks, ethical considerations, and counter-intuitive debates.
            </p>
          </div>

          <div className="space-y-4">
            {podcast.ethicsAndDiscipline.map((eth) => (
              <div
                key={eth.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white">{eth.topic}</h3>
                  <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Ethics & Discipline
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{eth.summary}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                      Discipline Takeaway
                    </span>
                    <p className="text-slate-200">{eth.disciplineTakeaway}</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                    <span className="font-semibold text-amber-400 uppercase tracking-wider text-[10px]">
                      Ethical Consideration
                    </span>
                    <p className="text-slate-200">{eth.ethicalConsideration}</p>
                  </div>
                </div>

                {eth.debatePoints && eth.debatePoints.length > 0 && (
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <span className="font-semibold text-purple-400 uppercase tracking-wider text-[10px]">
                      Critical Discussion & Debate Points
                    </span>
                    <ul className="space-y-1 text-slate-300">
                      {eth.debatePoints.map((db, dbIdx) => (
                        <li key={dbIdx} className="flex items-start gap-2">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>{db}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: INTERACTIVE QUIZ & REFLECTION */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-6 space-y-2">
            <h2 className="text-lg font-bold text-purple-300 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-400" />
              Interactive Questions & Active Recall
            </h2>
            <p className="text-xs text-purple-200/80 leading-relaxed">
              Test your understanding and reflect on how to apply the podcast’s core principles to your own work. Answering correctly increases your Mastery Score!
            </p>
          </div>

          <div className="space-y-4">
            {podcast.reflectionQuestions.map((q, qIdx) => {
              const selected = questionAnswers[q.id];
              const showHint = showAnswerHints[q.id];

              return (
                <div
                  key={q.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-400">Question {qIdx + 1}</span>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {q.type}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">{q.question}</h3>

                  {/* Multiple Choice Options if present */}
                  {q.options && q.options.length > 0 && (
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => handleAnswerSubmit(q.id, opt)}
                          className={`w-full p-3 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between ${
                            selected === opt
                              ? 'bg-purple-600/30 border-purple-500 text-white font-medium'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>{opt}</span>
                          {selected === opt && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Reflection Text Area if reflective */}
                  {(!q.options || q.options.length === 0) && (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={questionAnswers[q.id] || ''}
                        onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.id]: e.target.value })}
                        placeholder="Write down your thoughts and application strategy here..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}

                  {/* Answer Hint / Feedback */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <button
                      onClick={() =>
                        setShowAnswerHints((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                      }
                      className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      {showHint ? 'Hide Hint / Guidance' : 'Show Answer Hint'}
                    </button>

                    {selected && (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Answer Recorded (+10% Mastery)
                      </span>
                    )}
                  </div>

                  {showHint && q.answerHint && (
                    <div className="p-3 bg-slate-950 border border-indigo-500/30 rounded-xl text-xs text-indigo-200">
                      <strong>AI Guidance Hint:</strong> {q.answerHint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: TIMESTAMP FOCAL MATRIX */}
      {activeTab === 'timestamps' && (
        <div className="space-y-6">
          <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-2xl p-6 space-y-2">
            <h2 className="text-lg font-bold text-cyan-300 flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Timestamp Focal Matrix & AI Deep Analysis
            </h2>
            <p className="text-xs text-cyan-200/80 leading-relaxed">
              Click any timestamp to trigger a micro-analysis by Gemini, extracting deep quotes and a specific step-by-step business execution plan for that segment.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timestamp List */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Key Timestamp Markers
              </h3>
              {podcast.keyTimestamps.map((ts, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDeepFocusAnalysis(ts.timestamp)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    selectedTimestampRange === ts.timestamp
                      ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-lg'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                      {ts.timestamp}
                    </span>
                    <span className="text-[10px] text-slate-500">Analyze Segment</span>
                  </div>
                  <h4 className="text-xs font-bold mt-2 text-white">{ts.topic}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{ts.summary}</p>
                </button>
              ))}
            </div>

            {/* Deep Focus Analysis Results Panel */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="text-base font-bold text-white">
                    Deep Focus Analysis [{selectedTimestampRange}]
                  </h3>
                </div>
                {isFocusing && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing with Gemini...</span>
                  </div>
                )}
              </div>

              {deepFocusResult ? (
                <div className="space-y-4 text-xs sm:text-sm">
                  <h4 className="text-base font-bold text-cyan-300">{deepFocusResult.segmentTitle}</h4>

                  <div className="space-y-2">
                    <h5 className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                      Detailed Segment Breakdown
                    </h5>
                    <p className="text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                      {deepFocusResult.deepSummary}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-semibold text-amber-400 uppercase tracking-wider text-[10px]">
                      Business Execution Blueprint for this Window
                    </h5>
                    <ul className="space-y-1.5 bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-slate-200">
                      {deepFocusResult.businessBlueprint.map((bp, bpIdx) => (
                        <li key={bpIdx} className="flex items-start gap-2">
                          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{bp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h5 className="font-semibold text-purple-400 uppercase tracking-wider text-[10px]">
                      Impactful Direct Quotes
                    </h5>
                    <div className="space-y-2">
                      {deepFocusResult.keyQuotes.map((q, qIdx) => (
                        <blockquote
                          key={qIdx}
                          className="bg-slate-950 p-3 rounded-lg border-l-2 border-purple-500 italic text-slate-300 text-xs"
                        >
                          "{q}"
                        </blockquote>
                      ))}
                    </div>
                  </div>

                  <div className="bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-500/30 text-xs text-emerald-200">
                    <strong>Ethical Assessment:</strong> {deepFocusResult.ethicalAssessment}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">Click any timestamp marker on the left to generate deeper insights!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: JOURNAL & NOTES EDITOR */}
      {activeTab === 'notes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <FileText className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">Automated Note-Taking & Journal</h2>
            </div>
            <span className="text-xs text-slate-500">Auto-saved to Local Storage</span>
          </div>

          <textarea
            rows={12}
            value={userNotesText}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Type your personal insights, action plans, or copy key monetization steps here..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
          />

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{userNotesText.length} characters</span>
            <button
              onClick={handleCopyNotes}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Journal Notes</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
