import React, { useState } from 'react';
import { PodcastItem, EthicsAndDisciplineItem } from '../types';
import {
  ShieldCheck,
  Search,
  BookOpen,
  ArrowUpRight,
  Sparkles,
  Award,
  AlertTriangle,
} from 'lucide-react';

interface EthicsHubViewProps {
  podcasts: PodcastItem[];
  onSelectPodcast: (podcast: PodcastItem) => void;
}

export const EthicsHubView: React.FC<EthicsHubViewProps> = ({
  podcasts,
  onSelectPodcast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const allEthics: Array<{
    item: EthicsAndDisciplineItem;
    podcastTitle: string;
    podcastId: string;
    channel: string;
  }> = [];

  podcasts.forEach((p) => {
    p.ethicsAndDiscipline.forEach((eth) => {
      allEthics.push({
        item: eth,
        podcastTitle: p.title,
        podcastId: p.id,
        channel: p.channel,
      });
    });
  });

  const filteredEthics = allEthics.filter((x) => {
    const q = searchQuery.toLowerCase();
    return (
      x.item.topic.toLowerCase().includes(q) ||
      x.item.summary.toLowerCase().includes(q) ||
      x.item.disciplineTakeaway.toLowerCase().includes(q) ||
      x.podcastTitle.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Ethics, Discipline & Critical Discussion Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Personal mindset habits, moral dilemmas, operational discipline, and counter-intuitive debates from top leaders
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <Award className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Ethical Insights</p>
              <p className="text-lg font-bold text-white">{allEthics.length}</p>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Discipline Frameworks</p>
              <p className="text-lg font-bold text-indigo-400">{allEthics.length}</p>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Critical Debates</p>
              <p className="text-lg font-bold text-amber-400">
                {allEthics.reduce((acc, curr) => acc + (curr.item.debatePoints?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search ethics, discipline habits, or critical discussion topics..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Ethics Cards List */}
      <div className="space-y-4">
        {filteredEthics.map((eth, idx) => {
          const p = podcasts.find((x) => x.id === eth.podcastId);
          return (
            <div
              key={`${eth.item.id}-${idx}`}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl space-y-4 transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-white">{eth.item.topic}</h3>
                  {p && (
                    <button
                      onClick={() => onSelectPodcast(p)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>From: {eth.podcastTitle} ({eth.channel})</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  Ethics & Mindset
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{eth.item.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                    Discipline Takeaway
                  </span>
                  <p className="text-slate-200">{eth.item.disciplineTakeaway}</p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="font-semibold text-amber-400 uppercase tracking-wider text-[10px]">
                    Ethical Consideration
                  </span>
                  <p className="text-slate-200">{eth.item.ethicalConsideration}</p>
                </div>
              </div>

              {eth.item.debatePoints && eth.item.debatePoints.length > 0 && (
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <span className="font-semibold text-purple-400 uppercase tracking-wider text-[10px]">
                    Critical Discussion Points
                  </span>
                  <ul className="space-y-1 text-slate-300">
                    {eth.item.debatePoints.map((db, dbIdx) => (
                      <li key={dbIdx} className="flex items-start gap-2">
                        <span className="text-purple-400 font-bold">•</span>
                        <span>{db}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredEthics.length === 0 && (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No ethical or discipline notes found</p>
        </div>
      )}
    </div>
  );
};
