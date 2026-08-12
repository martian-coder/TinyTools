import React, { useState } from 'react';
import { PodcastItem } from '../types';
import {
  Sparkles,
  Share2,
  Copy,
  Check,
  Send,
  FileText,
  Twitter,
  Linkedin,
  Mail,
  Zap,
  Video,
  Bookmark,
} from 'lucide-react';

interface ContentStudioViewProps {
  podcasts: PodcastItem[];
}

export const ContentStudioView: React.FC<ContentStudioViewProps> = ({ podcasts }) => {
  const [selectedPodcastId, setSelectedPodcastId] = useState<string>(
    podcasts.length > 0 ? podcasts[0].id : ''
  );
  const [selectedFormat, setSelectedFormat] = useState<string>('X / Twitter Thread');
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const formats = [
    { name: 'X / Twitter Thread', icon: Twitter, color: 'text-sky-400', desc: '5-7 viral tweet drafts with hooks' },
    { name: 'LinkedIn Post', icon: Linkedin, color: 'text-blue-400', desc: 'Professional long-form post' },
    { name: 'Newsletter Digest', icon: Mail, color: 'text-amber-400', desc: 'Subscriber email with takeaways' },
    { name: 'Micro-SaaS Pitch', icon: Zap, color: 'text-emerald-400', desc: '1-page business proposal outline' },
    { name: 'Short Video Script', icon: Video, color: 'text-purple-400', desc: '60s TikTok/Reels audio & video script' },
  ];

  const currentPodcast = podcasts.find((p) => p.id === selectedPodcastId);

  const handleGenerate = async () => {
    if (!currentPodcast || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podcastTitle: currentPodcast.title,
          channel: currentPodcast.channel,
          summary: currentPodcast.shortSummary,
          takeaways: currentPodcast.actionableTakeaways,
          monetization: currentPodcast.monetizationOpportunities,
          format: selectedFormat,
        }),
      });

      const json = await response.json();
      if (json.success && json.generatedText) {
        setGeneratedContent(json.generatedText);
      }
    } catch (err) {
      console.error('Content generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-500/10">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Content Creation Studio & Repurposing Engine
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Transform podcast summaries, business blueprints, and quote clips into viral Twitter threads, LinkedIn posts, newsletter digests, or SaaS pitches
            </p>
          </div>
        </div>
      </div>

      {/* Selector Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Control Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 h-fit">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              1. Select Source Podcast
            </label>
            <select
              value={selectedPodcastId}
              onChange={(e) => setSelectedPodcastId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              {podcasts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.channel})
                </option>
              ))}
            </select>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              2. Select Output Format
            </label>
            <div className="space-y-2">
              {formats.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = selectedFormat === fmt.name;
                return (
                  <button
                    key={fmt.name}
                    onClick={() => setSelectedFormat(fmt.name)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${fmt.color}`} />
                      <div>
                        <p className="text-xs font-bold">{fmt.name}</p>
                        <p className="text-[10px] text-slate-500">{fmt.desc}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!selectedPodcastId || isGenerating}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Crafting Content with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate {selectedFormat}</span>
              </>
            )}
          </button>
        </div>

        {/* Output Studio Panel */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Publish-Ready Output: {selectedFormat}
                </h3>
              </div>

              {generatedContent && (
                <button
                  onClick={handleCopy}
                  className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {generatedContent ? (
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 text-xs sm:text-sm text-slate-200 font-sans leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto">
                {generatedContent}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500 space-y-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
                <Share2 className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs font-medium text-slate-400">
                  Select a podcast and click "Generate" to create Twitter threads, LinkedIn posts, or newsletters!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
