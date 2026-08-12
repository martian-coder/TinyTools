import React, { useState } from 'react';
import { KnowledgeGroup, PodcastItem, YouTubeSearchResult } from '../types';
import {
  Folder,
  FolderPlus,
  Sparkles,
  Plus,
  Trash2,
  Play,
  FileText,
  Copy,
  Check,
  Brain,
  Lightbulb,
  DollarSign,
  Rocket,
  ChevronRight,
  Layers,
  Search,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

interface KnowledgeGroupsViewProps {
  groups: KnowledgeGroup[];
  podcasts: PodcastItem[];
  onCreateGroup: (name: string, description: string, category: KnowledgeGroup['category']) => void;
  onDeleteGroup: (id: string) => void;
  onUpdateGroupNotes: (groupId: string, videoId: string, note: string) => void;
  onRemoveVideoFromGroup: (groupId: string, videoId: string) => void;
  onAddVideoToGroup: (groupId: string, videoId: string) => void;
  onSelectPodcast?: (p: PodcastItem) => void;
}

export const KnowledgeGroupsView: React.FC<KnowledgeGroupsViewProps> = ({
  groups,
  podcasts,
  onCreateGroup,
  onDeleteGroup,
  onUpdateGroupNotes,
  onRemoveVideoFromGroup,
  onAddVideoToGroup,
  onSelectPodcast,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || 'g-saas');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState<KnowledgeGroup['category']>('SaaS Products');

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [groupSynthesis, setGroupSynthesis] = useState<KnowledgeGroup['aiSynthesis'] | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const activeGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

  // Helper to find video metadata (from podcasts library or fallback catalog)
  const getGroupVideos = (videoIds: string[]) => {
    return videoIds.map((vId) => {
      const matchPod = podcasts.find((p) => p.youtubeVideoId === vId || p.id === vId);
      if (matchPod) {
        return {
          id: vId,
          title: matchPod.title,
          channel: matchPod.channel,
          thumbnailUrl: matchPod.thumbnailUrl,
          description: matchPod.shortSummary,
          podcastItem: matchPod,
        };
      }
      return {
        id: vId,
        title: `YouTube Video (${vId})`,
        channel: 'YouTube Creator',
        thumbnailUrl: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
        description: 'Saved video in knowledge cluster.',
      };
    });
  };

  const currentGroupVideos = activeGroup ? getGroupVideos(activeGroup.videoIds) : [];

  const handleSynthesize = async () => {
    if (!activeGroup || currentGroupVideos.length === 0) return;
    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/synthesize-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: activeGroup.name,
          groupCategory: activeGroup.category,
          videos: currentGroupVideos.map((v) => ({
            title: v.title,
            channel: v.channel,
            description: v.description,
            userNote: activeGroup.customNotesPerVideo?.[v.id] || '',
          })),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.synthesis) {
          setGroupSynthesis(json.synthesis);
        }
      }
    } catch (err) {
      console.error('Failed group synthesis:', err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    onCreateGroup(newGroupName.trim(), newGroupDesc.trim(), newGroupCategory);
    setNewGroupName('');
    setNewGroupDesc('');
    setIsCreateModalOpen(false);
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ─── Header Banner for Creators & Developers ───────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/20 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Knowledge Groups &amp; AI Product Clusters
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                  Creator &amp; Dev Workspace
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Group related podcasts together, write video-specific notes, and run AI multi-video synthesis for SaaS ideas &amp; content blueprints.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer flex items-center gap-2 shrink-0"
          >
            <FolderPlus className="w-4 h-4 text-amber-300" />
            <span>Create New Knowledge Group</span>
          </button>
        </div>

        {/* Knowledge Groups Chips */}
        <div className="flex items-center gap-2.5 overflow-x-auto pt-2 scrollbar-none text-xs">
          {groups.map((g) => {
            const isSelected = selectedGroupId === g.id;
            return (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedGroupId(g.id);
                  setGroupSynthesis(null);
                }}
                className={`px-4 py-2 rounded-2xl border font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-indigo-400'}`} />
                <span>{g.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}>
                  {g.videoIds.length} videos
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Active Knowledge Group Dashboard ─────────────────────────────── */}
      {activeGroup && (
        <div className="space-y-6">
          {/* Active Group Details Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{activeGroup.name}</h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                  {activeGroup.category}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">{activeGroup.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSynthesize}
                disabled={isSynthesizing || currentGroupVideos.length === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Brain className="w-4 h-4 text-slate-950 animate-bounce" />
                <span>{isSynthesizing ? 'Synthesizing with Gemini…' : 'Brainstorm Group with AI'}</span>
              </button>

              {groups.length > 1 && (
                <button
                  onClick={() => onDeleteGroup(activeGroup.id)}
                  className="p-2.5 text-slate-400 hover:text-red-400 bg-slate-950 border border-slate-800 rounded-2xl transition-colors cursor-pointer"
                  title="Delete Group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ─── Multi-Video AI Synthesis Output Section ────────────────────── */}
          {(groupSynthesis || isSynthesizing) && (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-500/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Gemini AI Multi-Video Synthesis &amp; Revenue Blueprint
                    </h3>
                    <p className="text-xs text-indigo-300">
                      Cross-analysis of {currentGroupVideos.length} videos in "{activeGroup.name}"
                    </p>
                  </div>
                </div>

                {groupSynthesis && (
                  <button
                    onClick={() =>
                      handleCopyText(
                        'synthesis',
                        `AI Synthesis for ${activeGroup.name}:\n\nSummary:\n${groupSynthesis.summary}\n\nProduct Ideas:\n${groupSynthesis.productIdeas.join(
                          '\n'
                        )}\n\nAction Blueprint:\n${groupSynthesis.actionBlueprint.join('\n')}`
                      )
                    }
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                  >
                    {copiedSection === 'synthesis' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{copiedSection === 'synthesis' ? 'Copied' : 'Export Report'}</span>
                  </button>
                )}
              </div>

              {isSynthesizing ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-indigo-300">
                    Cross-analyzing video frameworks, monetization models &amp; user notes...
                  </p>
                </div>
              ) : (
                groupSynthesis && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs leading-relaxed">
                    {/* Column 1: Combined Executive Summary */}
                    <div className="lg:col-span-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3 shadow">
                      <div className="flex items-center gap-2 font-bold text-white text-xs uppercase tracking-wider">
                        <FileText className="w-4 h-4 text-indigo-400" /> Synthesized Core Summary
                      </div>
                      <p className="text-slate-300 leading-relaxed font-mono">{groupSynthesis.summary}</p>
                    </div>

                    {/* Column 2: Product & SaaS Ideas */}
                    <div className="lg:col-span-1 bg-slate-950/80 border border-indigo-500/40 rounded-2xl p-5 space-y-3 shadow">
                      <div className="flex items-center gap-2 font-bold text-amber-300 text-xs uppercase tracking-wider">
                        <Lightbulb className="w-4 h-4 text-amber-400" /> Monetizable Product Ideas
                      </div>
                      <ul className="space-y-2 text-slate-200">
                        {groupSynthesis.productIdeas.map((idea, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                            <span>{idea}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Column 3: 7-Day Developer Execution Plan */}
                    <div className="lg:col-span-1 bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-5 space-y-3 shadow">
                      <div className="flex items-center gap-2 font-bold text-emerald-300 text-xs uppercase tracking-wider">
                        <Rocket className="w-4 h-4 text-emerald-400" /> 7-Day Developer Action Plan
                      </div>
                      <ol className="space-y-2 text-slate-200">
                        {groupSynthesis.actionBlueprint.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-emerald-500/20">
                            <span className="font-mono text-[11px] font-bold text-emerald-400 shrink-0">#{idx + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ─── Videos in Group & Custom Notes Grid ─────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" /> Curated Videos in Group ({currentGroupVideos.length})
              </span>
            </div>

            {currentGroupVideos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {currentGroupVideos.map((v) => {
                  const currentNote = activeGroup.customNotesPerVideo?.[v.id] || '';

                  return (
                    <div
                      key={v.id}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 hover:border-indigo-500/40 transition-all shadow-xl flex flex-col justify-between"
                    >
                      {/* Video Item Header */}
                      <div className="flex gap-4 items-start">
                        <div className="relative w-32 h-20 rounded-2xl overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
                          <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                          <a
                            href={`https://www.youtube.com/watch?v=${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
                          >
                            <Play className="w-6 h-6 text-white fill-white" />
                          </a>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <h4 className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2">
                            {v.title}
                          </h4>
                          <p className="text-xs text-red-400 font-semibold">{v.channel}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{v.description}</p>
                        </div>
                      </div>

                      {/* Video-Specific Notes Journal */}
                      <div className="space-y-2 pt-3 border-t border-slate-800">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-400" /> My Video Notes &amp; Timestamps:
                          </span>
                          <button
                            onClick={() => onRemoveVideoFromGroup(activeGroup.id, v.id)}
                            className="text-slate-500 hover:text-red-400 cursor-pointer text-[10px] font-semibold hover:underline"
                          >
                            Remove from group
                          </button>
                        </div>

                        <textarea
                          rows={3}
                          value={currentNote}
                          onChange={(e) => onUpdateGroupNotes(activeGroup.id, v.id, e.target.value)}
                          placeholder="Write video-specific insights, code snippets, timestamps, or product ideas for this video..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 placeholder-slate-600 resize-none"
                        />
                      </div>

                      {v.podcastItem && onSelectPodcast && (
                        <button
                          onClick={() => onSelectPodcast(v.podcastItem)}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-indigo-300 hover:text-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>Open Full AI Summary &amp; Business Blueprint</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                <Folder className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No videos in this knowledge group yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Search YouTube or browse your library to add videos to "{activeGroup.name}".
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Create Group Modal ───────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-indigo-400" />
              Create Knowledge &amp; AI Product Group
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Group Name</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Agentic AI Workflows, SaaS Monetization"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Category Focus</label>
                <select
                  value={newGroupCategory}
                  onChange={(e) => setNewGroupCategory(e.target.value as KnowledgeGroup['category'])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="SaaS Products">💰 SaaS Products &amp; Monetization</option>
                  <option value="AI & Tech Stack">🤖 AI &amp; Tech Stack</option>
                  <option value="Content Creation">🎬 Content &amp; Media Creation</option>
                  <option value="Mindset & Growth">🧠 Mindset &amp; Focus</option>
                  <option value="Custom">📌 Custom Group</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Short thesis of what product or content is being built from this group..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
