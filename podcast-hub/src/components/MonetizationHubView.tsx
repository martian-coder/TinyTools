import React, { useState } from 'react';
import { PodcastItem, MonetizationOpportunity } from '../types';
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

  // Aggregate all opportunities from all podcasts
  const allOpportunities: Array<{
    opportunity: MonetizationOpportunity;
    podcastTitle: string;
    podcastId: string;
    channel: string;
  }> = [];

  podcasts.forEach((p) => {
    p.monetizationOpportunities.forEach((opp) => {
      allOpportunities.push({
        opportunity: opp,
        podcastTitle: p.title,
        podcastId: p.id,
        channel: p.channel,
      });
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
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border border-amber-500/30 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <Lightbulb className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Business Opportunities & Revenue Models Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Aggregated business concepts, micro-SaaS blueprints, and monetization tactics extracted across your podcasts
            </p>
          </div>
        </div>

        {/* Global Opportunities Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Ideas</p>
              <p className="text-lg font-bold text-white">{allOpportunities.length}</p>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Easy Execution</p>
              <p className="text-lg font-bold text-emerald-400">
                {allOpportunities.filter((o) => o.opportunity.difficulty === 'Easy').length}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Medium Difficulty</p>
              <p className="text-lg font-bold text-amber-400">
                {allOpportunities.filter((o) => o.opportunity.difficulty === 'Medium').length}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Hard / Enterprise</p>
              <p className="text-lg font-bold text-purple-400">
                {allOpportunities.filter((o) => o.opportunity.difficulty === 'Hard').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search business ideas or models..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs font-medium">
          <span className="text-slate-400 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Difficulty:
          </span>
          {(['All', 'Easy', 'Medium', 'Hard'] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => setFilterDifficulty(diff)}
              className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                filterDifficulty === diff
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunity Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOpportunities.map((item, idx) => {
          const p = podcasts.find((x) => x.id === item.podcastId);
          return (
            <div
              key={`${item.opportunity.id}-${idx}`}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between transition-all hover:-translate-y-1"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {item.opportunity.model}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      item.opportunity.difficulty === 'Easy'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : item.opportunity.difficulty === 'Medium'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}
                  >
                    {item.opportunity.difficulty}
                  </span>
                </div>

                {/* Source Podcast Pill */}
                {p && (
                  <button
                    onClick={() => onSelectPodcast(p)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer truncate"
                  >
                    <span>From: {item.podcastTitle}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}

                <h3 className="text-base font-bold text-white leading-snug">
                  {item.opportunity.title}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {item.opportunity.description}
                </p>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Revenue Potential:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {item.opportunity.potentialRevenue}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Action Roadmap
                  </span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {item.opportunity.actionSteps.map((step, sIdx) => (
                      <li key={sIdx} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold">•</span>
                        <span className="line-clamp-2">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => handleCopyOpportunity(item)}
                  className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 rounded-xl border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copiedId === item.opportunity.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied Blueprint!</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Copy Blueprint</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredOpportunities.length === 0 && (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <Lightbulb className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No monetization ideas found matching filters</p>
          <p className="text-xs text-slate-500">Try adjusting your search query or difficulty selector</p>
        </div>
      )}
    </div>
  );
};
