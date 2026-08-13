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
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Page Header Toolbar Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-800">
                  Knowledge Groups &amp; AI Product Clusters
                </h1>
                <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-medium">
                  Workspace
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Group related podcasts together, write video notes, and run AI multi-video synthesis for SaaS ideas &amp; blueprints.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 text-white rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
            style={{ background: '#11A888' }}
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Knowledge Group</span>
          </button>
        </div>

        {/* Knowledge Groups Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 scrollbar-none text-xs">
          {groups.map((g) => {
            const isSelected = selectedGroupId === g.id;
            return (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedGroupId(g.id);
                  setGroupSynthesis(null);
                }}
                className={`px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#11A888] text-white border-transparent shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-teal-600'}`} />
                <span>{g.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {g.videoIds.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Knowledge Group Dashboard */}
      {activeGroup && (
        <div className="space-y-5">
          {/* Active Group Details Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-800">{activeGroup.name}</h2>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                  {activeGroup.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">{activeGroup.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSynthesize}
                disabled={isSynthesizing || currentGroupVideos.length === 0}
                className="px-4 py-2 text-white font-medium rounded-lg text-xs transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                style={{ background: '#11A888' }}
              >
                <Brain className="w-4 h-4 text-white" />
                <span>{isSynthesizing ? 'Synthesizing with Gemini…' : 'Brainstorm Group with AI'}</span>
              </button>

              {groups.length > 1 && (
                <button
                  onClick={() => onDeleteGroup(activeGroup.id)}
                  className="p-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                  title="Delete Group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Multi-Video AI Synthesis Output Section */}
          {(groupSynthesis || isSynthesizing) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Gemini AI Multi-Video Synthesis &amp; Revenue Blueprint
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cross-analysis of {currentGroupVideos.length} videos in &quot;{activeGroup.name}&quot;
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
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
                  >
                    {copiedSection === 'synthesis' ? (
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{copiedSection === 'synthesis' ? 'Copied' : 'Export Report'}</span>
                  </button>
                )}
              </div>

              {isSynthesizing ? (
                <div className="text-center py-10 space-y-2">
                  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-medium text-slate-600">
                    Cross-analyzing video frameworks, monetization models &amp; user notes...
                  </p>
                </div>
              ) : (
                groupSynthesis && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs leading-relaxed">
                    {/* Column 1: Combined Executive Summary */}
                    <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
                        <FileText className="w-4 h-4 text-teal-600" /> Synthesized Core Summary
                      </div>
                      <p className="text-slate-700 leading-relaxed font-normal">{groupSynthesis.summary}</p>
                    </div>

                    {/* Column 2: Product & SaaS Ideas */}
                    <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
                        <Lightbulb className="w-4 h-4 text-amber-500" /> Monetizable Product Ideas
                      </div>
                      <ul className="space-y-2 text-slate-700">
                        {groupSynthesis.productIdeas.map((idea, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-white p-2.5 rounded border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <span>{idea}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Column 3: 7-Day Developer Execution Plan */}
                    <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
                        <Rocket className="w-4 h-4 text-teal-600" /> 7-Day Action Plan
                      </div>
                      <ol className="space-y-2 text-slate-700">
                        {groupSynthesis.actionBlueprint.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-white p-2.5 rounded border border-slate-200">
                            <span className="font-mono text-[11px] font-semibold text-teal-600 shrink-0">#{idx + 1}</span>
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

          {/* Videos in Group & Custom Notes Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Curated Videos in Group ({currentGroupVideos.length})
              </span>
            </div>

            {currentGroupVideos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentGroupVideos.map((v) => {
                  const currentNote = activeGroup.customNotesPerVideo?.[v.id] || '';

                  return (
                    <div
                      key={v.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 hover:border-slate-300 transition-all shadow-2xs flex flex-col justify-between"
                    >
                      {/* Video Item Header */}
                      <div className="flex gap-3 items-start">
                        <div className="relative w-28 h-18 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                          <a
                            href={`https://www.youtube.com/watch?v=${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity"
                          >
                            <Play className="w-5 h-5 text-white fill-white" />
                          </a>
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <h4 className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                            {v.title}
                          </h4>
                          <p className="text-[11px] text-teal-600 font-medium">{v.channel}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{v.description}</p>
                        </div>
                      </div>

                      {/* Video-Specific Notes Journal */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-600 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" /> Video Notes &amp; Timestamps:
                          </span>
                          <button
                            onClick={() => onRemoveVideoFromGroup(activeGroup.id, v.id)}
                            className="text-slate-400 hover:text-red-600 cursor-pointer text-[10px] font-medium"
                          >
                            Remove
                          </button>
                        </div>

                        <textarea
                          rows={2}
                          value={currentNote}
                          onChange={(e) => onUpdateGroupNotes(activeGroup.id, v.id, e.target.value)}
                          placeholder="Write video insights, code snippets, timestamps, or product ideas..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-normal leading-relaxed focus:outline-none focus:border-teal-400 placeholder-slate-400 resize-none"
                        />
                      </div>

                      {v.podcastItem && onSelectPodcast && (
                        <button
                          onClick={() => onSelectPodcast(v.podcastItem)}
                          className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1 border border-slate-200"
                        >
                          <span>Open Full AI Summary</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-white border border-slate-200 rounded-xl space-y-2">
                <Folder className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-medium text-slate-700">No videos in this group yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Search YouTube or browse your library to add videos to &quot;{activeGroup.name}&quot;.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-teal-600" />
              Create Knowledge &amp; AI Product Group
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-slate-600">Group Name</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Agentic AI Workflows, SaaS Monetization"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-400"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-600">Category Focus</label>
                <select
                  value={newGroupCategory}
                  onChange={(e) => setNewGroupCategory(e.target.value as KnowledgeGroup['category'])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-400"
                >
                  <option value="SaaS Products">💰 SaaS Products &amp; Monetization</option>
                  <option value="AI & Tech Stack">🤖 AI &amp; Tech Stack</option>
                  <option value="Content Creation">🎬 Content &amp; Media Creation</option>
                  <option value="Mindset & Growth">🧠 Mindset &amp; Focus</option>
                  <option value="Custom">📌 Custom Group</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-600">Description</label>
                <textarea
                  rows={2}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Short thesis of what product or content is being built from this group..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-white rounded-lg font-medium shadow-2xs cursor-pointer"
                  style={{ background: '#11A888' }}
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
