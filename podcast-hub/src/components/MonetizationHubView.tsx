import React, { useState } from 'react';
import { PodcastItem, MonetizationOpportunity } from '../types';
import { VideoThumbnail } from './VideoThumbnail';
import {
  Lightbulb,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Zap,
  Bookmark,
  Check,
  ArrowUpRight,
  Sparkles,
  Brain,
  Play,
} from 'lucide-react';

interface MonetizationHubViewProps {
  podcasts: PodcastItem[];
  onSelectPodcast: (podcast: PodcastItem) => void;
}

export const MonetizationHubView: React.FC<MonetizationHubViewProps> = ({
  podcasts,
  onSelectPodcast,
}) => {
  const [filterDifficulty, setFilterDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Aggregate and deduplicate all opportunities from all podcasts
  const allOpportunities: Array<{
    opportunity: MonetizationOpportunity;
    podcastTitle: string;
    podcastId: string;
    channel: string;
  }> = [];

  const seenOppIds = new Set<string>();

  podcasts.forEach((p) => {
    (p.monetizationOpportunities || []).forEach((opp) => {
      // Normalize title string for strict deduplication
      const cleanTitle = (opp.title || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
      const uniqueKey = cleanTitle || (opp.id || '').trim();
      
      if (uniqueKey && !seenOppIds.has(uniqueKey)) {
        seenOppIds.add(uniqueKey);
        allOpportunities.push({
          opportunity: opp,
          podcastTitle: p.title,
          podcastId: p.id,
          channel: p.channel,
        });
      }
    });
  });

  const filteredOpportunities = allOpportunities.filter((item) => {
    const matchesDifficulty =
      filterDifficulty === 'All' || item.opportunity.difficulty === filterDifficulty;
    const matchesQuery =
      item.opportunity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.opportunity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.opportunity.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.podcastTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDifficulty && matchesQuery;
  });

  const handleCopyOpportunity = (item: any) => {
    const text = `
Business Idea: ${item.opportunity.title}
Revenue Model: ${item.opportunity.model}
Potential Revenue: ${item.opportunity.potentialRevenue}
Execution Difficulty: ${item.opportunity.difficulty}
Source Podcast: ${item.podcastTitle} (${item.channel})

Description:
${item.opportunity.description}

Action Steps:
${item.opportunity.actionSteps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}
`;

    navigator.clipboard.writeText(text);
    setCopiedId(item.opportunity.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Hero Banner Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-800">
                Business Opportunities & Revenue Models Hub
              </h1>
              <p className="text-xs text-slate-500">
                Aggregated business concepts, micro-SaaS blueprints, and monetization tactics extracted across your podcasts
              </p>
            </div>
          </div>
        </div>

        {/* Global Opportunities Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-teal-600 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Ideas</p>
              <p className="text-base font-semibold text-slate-800">{allOpportunities.length}</p>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Easy Execution</p>
              <p className="text-base font-semibold text-emerald-700">
                {allOpportunities.filter((o) => o.opportunity.difficulty === 'Easy').length}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-2.5">
            <DollarSign className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Medium Difficulty</p>
              <p className="text-base font-semibold text-amber-700">
                {allOpportunities.filter((o) => o.opportunity.difficulty === 'Medium').length}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Hard / Enterprise</p>
              <p className="text-base font-semibold text-purple-700">
                {allOpportunities.filter((o) => o.opportunity.difficulty === 'Hard').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search business ideas or models..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 font-normal"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs font-medium">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5" /> Difficulty:
          </span>
          {(['All', 'Easy', 'Medium', 'Hard'] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => setFilterDifficulty(diff)}
              className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterDifficulty === diff
                  ? 'bg-[#11A888] text-white border-transparent shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunity Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOpportunities.map((item, idx) => {
          const p = podcasts.find((x) => x.id === item.podcastId);
          return (
            <div
              key={`${item.opportunity.id}-${idx}`}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden shadow-2xs flex flex-col justify-between transition-all group"
            >
              <div>
                {/* ── Video Thumbnail Header ── */}
                {p && (
                  <div
                    onClick={() => onSelectPodcast(p)}
                    className="relative aspect-video w-full overflow-hidden bg-slate-100 cursor-pointer"
                  >
                    <VideoThumbnail
                      videoId={p.youtubeVideoId || p.id}
                      thumbnailUrl={p.thumbnailUrl}
                      title={p.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-slate-800 text-slate-800 ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-medium px-2 py-0.5 rounded backdrop-blur-xs max-w-[85%] truncate">
                      {p.channel}
                    </div>
                  </div>
                )}

                <div className="p-5 space-y-3.5">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                      {item.opportunity.model}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                        item.opportunity.difficulty === 'Easy'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : item.opportunity.difficulty === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {item.opportunity.difficulty}
                    </span>
                  </div>

                  {/* Source Podcast Title */}
                  {p && (
                    <button
                      onClick={() => onSelectPodcast(p)}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 cursor-pointer truncate w-full text-left"
                    >
                      <span className="truncate">From: {item.podcastTitle}</span>
                      <ArrowUpRight className="w-3 h-3 shrink-0" />
                    </button>
                  )}

                  <h3 className="text-sm font-semibold text-slate-800 leading-snug">
                    {item.opportunity.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {item.opportunity.description}
                  </p>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Revenue Potential:</span>
                    <span className="font-semibold text-emerald-700 font-mono">
                      {item.opportunity.potentialRevenue}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      Action Roadmap
                    </span>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {item.opportunity.actionSteps.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-1.5">
                          <span className="text-teal-600 font-bold">•</span>
                          <span className="line-clamp-2">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0 flex items-center gap-2">
                {p && (
                  <button
                    onClick={() => onSelectPodcast(p)}
                    className="flex-1 bg-[#11A888] hover:bg-[#0e9478] text-white py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>Brainstorm with AI</span>
                  </button>
                )}

                <button
                  onClick={() => handleCopyOpportunity(item)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Copy Blueprint text"
                >
                  {copiedId === item.opportunity.id ? (
                    <Check className="w-3.5 h-3.5 text-teal-600" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredOpportunities.length === 0 && (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl space-y-2">
          <Lightbulb className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No monetization ideas found matching filters</p>
          <p className="text-xs text-slate-400">Try adjusting your search query or difficulty selector</p>
        </div>
      )}
    </div>
  );
};
