import React, { useState } from 'react';
import { PodcastItem } from '../types';
import {
  X,
  Sparkles,
  Youtube,
  FileText,
  Clock,
  Upload,
  AlertCircle,
  CheckCircle2,
  ListPlus,
  Compass,
} from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPodcast: (item: PodcastItem) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onAddPodcast,
}) => {
  const [sourceType, setSourceType] = useState<'url' | 'transcript' | 'sample'>('url');
  const [urlOrChannel, setUrlOrChannel] = useState('');
  const [title, setTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [timestampFocus, setTimestampFocus] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setTranscriptText(text);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    setErrorMessage(null);
    if (!title && !urlOrChannel && !transcriptText) {
      setErrorMessage('Please provide a podcast URL, channel name, or transcript text.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep('Initializing Gemini AI engine...');

    try {
      setTimeout(() => setAnalysisStep('Analyzing audio transcript & key discussions...'), 1200);
      setTimeout(() => setAnalysisStep('Synthesizing Short & Detailed Summaries...'), 2400);
      setTimeout(() => setAnalysisStep('Extracting Business Opportunities & Monetization Models...'), 3800);
      setTimeout(() => setAnalysisStep('Framing Discipline, Ethics & Critical Debates...'), 5200);
      setTimeout(() => setAnalysisStep('Generating Reflection Questions & Interactive Timestamps...'), 6500);

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || urlOrChannel || 'Imported Podcast Analysis',
          source: urlOrChannel || 'Direct Transcript Import',
          content: transcriptText || `Podcast Title: ${title || urlOrChannel}. Generate comprehensive short & detailed summary, business opportunities, ethics, discipline, and questions.`,
          timestampFocus,
          customPrompt,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to process podcast summary');
      }

      const data = json.data;

      const newPodcast: PodcastItem = {
        id: `pod-${Date.now()}`,
        title: data.title || title || 'AI Analyzed Podcast',
        source: urlOrChannel || 'Web Source',
        channel: data.source || 'Imported Channel',
        thumbnailUrl:
          'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80',
        dateAdded: new Date().toISOString().split('T')[0],
        duration: data.duration || '45m',
        status: 'Unread',
        masteryLevel: 0,
        shortSummary: data.shortSummary || 'Summary successfully generated.',
        detailedSummary: data.detailedSummary || [],
        monetizationOpportunities: (data.monetizationOpportunities || []).map(
          (m: any, idx: number) => ({ ...m, id: `mon-${Date.now()}-${idx}` })
        ),
        ethicsAndDiscipline: (data.ethicsAndDiscipline || []).map(
          (e: any, idx: number) => ({ ...e, id: `eth-${Date.now()}-${idx}` })
        ),
        reflectionQuestions: (data.reflectionQuestions || []).map(
          (q: any, idx: number) => ({ ...q, id: `q-${Date.now()}-${idx}` })
        ),
        keyTimestamps: data.keyTimestamps || [],
        actionableTakeaways: data.actionableTakeaways || [],
        tags: data.tags || ['Podcast', 'AI Summary'],
        userNotes: '',
        bookmarkedTimestamps: [],
      };

      onAddPodcast(newPodcast);
      setIsAnalyzing(false);
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Error communicating with AI service.');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-3 sm:p-4 pt-6 sm:pt-12 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl text-slate-800 dark:text-slate-100 overflow-hidden relative my-4 sm:my-8 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-slate-50/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-blue-600 p-0.5 shadow-md shadow-amber-400/20">
              <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-amber-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Import & Summarize Podcast</h2>
              <p className="text-xs text-slate-500 font-medium">
                Extract short/detailed summaries, business opportunities, ethics & timestamps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Source Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSourceType('url')}
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer shadow-sm ${
                sourceType === 'url'
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-white font-bold'
                  : 'bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Youtube className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-xs font-bold">YouTube / Podcast Link</p>
                <p className="text-[11px] opacity-70">URL, Video ID, or Channel</p>
              </div>
            </button>

            <button
              onClick={() => setSourceType('transcript')}
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer shadow-sm ${
                sourceType === 'transcript'
                  ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-white font-bold'
                  : 'bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">Transcript or File</p>
                <p className="text-[11px] opacity-70">Paste text or upload file</p>
              </div>
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Podcast Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Podcast Title / Episode Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lex Fridman #420: AI Ethics, Discipline & Monetization Models"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
              />
            </div>

            {sourceType === 'url' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  YouTube Video / Podcast Channel URL
                </label>
                <input
                  type="text"
                  value={urlOrChannel}
                  onChange={(e) => setUrlOrChannel(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or Channel Name"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Transcript Text or Notes
                  </label>
                  <label className="text-xs text-blue-600 font-bold hover:text-blue-500 cursor-pointer flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    Upload .txt / .md
                    <input
                      type="file"
                      accept=".txt,.md,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  placeholder="Paste transcript lines or show notes here..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                />
              </div>
            )}

            {/* Optional Timestamp Focal Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Specific Timestamp Focus (Optional)
                </label>
                <input
                  type="text"
                  value={timestampFocus}
                  onChange={(e) => setTimestampFocus(e.target.value)}
                  placeholder="e.g. 15:30 - 32:00 Focus on SaaS Pricing"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-500" />
                  Custom AI Focus Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. Highlight micro-SaaS & personal discipline"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none shadow-inner"
                />
              </div>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2 text-xs text-red-600 dark:text-red-300 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {isAnalyzing && (
              <div className="p-4 bg-amber-50/80 dark:bg-blue-950/40 border border-amber-300/60 dark:border-blue-500/30 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-600 dark:border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold text-slate-900 dark:text-amber-300">{analysisStep}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden p-0.5">
                  <div className="bg-gradient-to-r from-blue-600 via-amber-400 to-blue-500 h-full w-3/4 rounded-full animate-pulse" />
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  Gemini server-side API is parsing transcripts, deriving business revenue models, and framing ethical reflection questions...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/90 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{isAnalyzing ? 'Analyzing with AI...' : 'Generate AI Summary & Ideas'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
