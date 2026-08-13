import React, { useState } from 'react';
import { PodcastItem, EthicsAndDisciplineItem } from '../types';
import { ShieldCheck, Search, Award, AlertTriangle, ArrowUpRight } from 'lucide-react';

interface EthicsHubViewProps {
  podcasts: PodcastItem[];
  onSelectPodcast: (podcast: PodcastItem) => void;
}

export const EthicsHubView: React.FC<EthicsHubViewProps> = ({ podcasts, onSelectPodcast }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const allEthics: Array<{ item: EthicsAndDisciplineItem; podcastTitle: string; podcastId: string; channel: string }> = [];
  podcasts.forEach((p) => {
    p.ethicsAndDiscipline.forEach((eth) => {
      allEthics.push({ item: eth, podcastTitle: p.title, podcastId: p.id, channel: p.channel });
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
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#e6f7f4' }}>
            <ShieldCheck className="w-5 h-5" style={{ color: '#11A888' }} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">Ethics & Discipline Hub</h1>
            <p className="text-xs text-slate-400 mt-0.5">Mindset habits, moral dilemmas and critical debates from top leaders</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <Award className="w-3.5 h-3.5 text-teal-500" />{allEthics.length} Insights
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            {allEthics.reduce((a, c) => a + (c.item.debatePoints?.length || 0), 0)} Debates
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search ethics, discipline habits, or discussion topics..."
          className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-400 placeholder:text-slate-400"
        />
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filteredEthics.map((eth, idx) => {
          const p = podcasts.find((x) => x.id === eth.podcastId);
          return (
            <div key={`${eth.item.id}-${idx}`} className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl p-5 space-y-3 transition-all">
              <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-semibold text-slate-800">{eth.item.topic}</h3>
                  {p && (
                    <button onClick={() => onSelectPodcast(p)} className="flex items-center gap-1 text-[11px] font-medium cursor-pointer transition-colors" style={{ color: '#11A888' }}>
                      <span>From: {eth.podcastTitle} · {eth.channel}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-teal-50 border border-teal-200" style={{ color: '#11A888' }}>
                  Ethics & Mindset
                </span>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">{eth.item.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Discipline Takeaway</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{eth.item.disciplineTakeaway}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Ethical Consideration</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{eth.item.ethicalConsideration}</p>
                </div>
              </div>

              {eth.item.debatePoints && eth.item.debatePoints.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Critical Discussion Points</span>
                  <ul className="space-y-1">
                    {eth.item.debatePoints.map((db, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        {db}
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
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl space-y-2">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600">No ethical or discipline notes found</p>
          <p className="text-xs text-slate-400">Import and analyze podcasts to start building your ethics hub.</p>
        </div>
      )}
    </div>
  );
};
