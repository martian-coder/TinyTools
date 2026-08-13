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
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Hero Banner Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">
              Content Creation Studio & Repurposing Engine
            </h1>
            <p className="text-xs text-slate-500">
              Transform podcast summaries, business blueprints, and quote clips into viral Twitter threads, LinkedIn posts, newsletter digests, or SaaS pitches
            </p>
          </div>
        </div>
      </div>

      {/* Selector Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Control Box */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5 h-fit">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              1. Select Source Podcast
            </label>
            <select
              value={selectedPodcastId}
              onChange={(e) => setSelectedPodcastId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-400 font-normal"
            >
              {podcasts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.channel})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 block">
              2. Select Content Format
            </label>
            <div className="space-y-2">
              {formats.map((f) => {
                const Icon = f.icon;
                const isSelected = selectedFormat === f.name;
                return (
                  <button
                    key={f.name}
                    onClick={() => setSelectedFormat(f.name)}
                    className={`w-full p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'bg-teal-50 border-teal-300 text-slate-800 shadow-2xs font-medium'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${f.color}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{f.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{f.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!currentPodcast || isGenerating}
            className="w-full bg-[#11A888] hover:bg-[#0e9478] text-white py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating {selectedFormat}...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Repurposed Content</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Display Box */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between min-h-[420px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-semibold text-slate-800">
                  Generated Output: {selectedFormat}
                </h3>
              </div>

              {generatedContent && (
                <button
                  onClick={handleCopy}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Draft</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {generatedContent ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-700 whitespace-pre-line leading-relaxed overflow-y-auto max-h-[480px]">
                {generatedContent}
              </div>
            ) : (
              <div className="text-center py-20 border border-dashed border-slate-200 rounded-lg space-y-2">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-600">Select a podcast and format on the left</p>
                <p className="text-[11px] text-slate-400">Click &quot;Generate Repurposed Content&quot; to draft viral posts</p>
              </div>
            )}
          </div>

          {generatedContent && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Ready for publishing on social platforms</span>
              <span className="font-semibold text-teal-600">AI Repurposing Engine Active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
