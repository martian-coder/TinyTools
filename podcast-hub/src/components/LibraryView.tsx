import React, { useState, useEffect } from 'react';
import { PodcastItem, PodcastStatus, SavedCollection, ViewTab, KnowledgeGroup } from '../types';
import { PodcastCard } from './PodcastCard';
import { GoogleSignInCard } from './GoogleSignInCard';
import {
  BookOpen,
  Folder,
  FolderPlus,
  Clock,
  Bookmark,
  CheckCircle2,
  Tv,
  PlusCircle,
  Sparkles,
  TrendingUp,
  X,
  Plus,
  Play,
  Heart,
  User,
  LogOut,
  ChevronRight,
  Filter,
  Brain,
  Layers,
} from 'lucide-react';

import { AddToGroupDropdown } from './AddToGroupDropdown';
import { YouTubeVideoCard } from './YouTubeVideoCard';

interface LibraryViewProps {
  podcasts: PodcastItem[];
  collections: SavedCollection[];
  knowledgeGroups?: KnowledgeGroup[];
  onSelectPodcast: (p: PodcastItem) => void;
  onDeletePodcast: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCreateCollection: (name: string, description: string, color: string) => void;
  onDeleteCollection: (id: string) => void;
  onOpenImport: () => void;
  onNavigateTab: (tab: ViewTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onAddVideoToGroup?: (groupId: string, video: any) => void;
  onCreateKnowledgeGroup?: (name: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  podcasts,
  collections,
  knowledgeGroups = [],
  onSelectPodcast,
  onDeletePodcast,
  onToggleStatus,
  onToggleFavorite,
  onCreateCollection,
  onDeleteCollection,
  onOpenImport,
  onNavigateTab,
  searchQuery,
  setSearchQuery,
  onAddVideoToGroup,
  onCreateKnowledgeGroup,
}) => {
  const [activeFilter, setActiveFilter] = useState<'All' | 'Favorites' | 'WatchLater' | 'Completed'>('All');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Connected Profile State
  const [ytProfile, setYtProfile] = useState<{
    name: string;
    handle: string;
    avatar: string;
    email?: string;
    accessToken?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('user_yt_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Live YouTube User Data
  const [liveYtPlaylists, setLiveYtPlaylists] = useState<
    Array<{ id: string; name: string; description: string; thumbnail: string; itemCount: number }>
  >([]);
  const [liveYtLikedVideos, setLiveYtLikedVideos] = useState<Array<any>>([]);
  const [isLoadingLiveYt, setIsLoadingLiveYt] = useState(false);

  useEffect(() => {
    const handleProfileSync = () => {
      try {
        const saved = localStorage.getItem('user_yt_profile');
        setYtProfile(saved ? JSON.parse(saved) : null);
      } catch {
        setYtProfile(null);
      }
    };
    window.addEventListener('yt_profile_updated', handleProfileSync);
    window.addEventListener('storage', handleProfileSync);
    return () => {
      window.removeEventListener('yt_profile_updated', handleProfileSync);
      window.removeEventListener('storage', handleProfileSync);
    };
  }, []);

  // Live Subscriptions Feed Data
  const [liveSubFeed, setLiveSubFeed] = useState<Array<any>>([]);

  // Fetch real YouTube playlists, liked videos, and subscription feed automatically
  useEffect(() => {
    const fetchLiveYtData = async () => {
      setIsLoadingLiveYt(true);
      try {
        const accessToken = ytProfile?.accessToken || '';
        const handle = ytProfile?.handle || '';

        // 1. Fetch playlists
        const plRes = await fetch('/api/youtube/my-playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken, handle }),
        });
        if (plRes.ok) {
          const plJson = await plRes.json();
          if (plJson.playlists && plJson.playlists.length > 0) {
            setLiveYtPlaylists(plJson.playlists);
          }
        }

        // 2. Fetch liked videos
        if (accessToken) {
          const likedRes = await fetch('/api/youtube/my-liked-videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: accessToken }),
          });
          if (likedRes.ok) {
            const likedJson = await likedRes.json();
            if (likedJson.results && likedJson.results.length > 0) {
              setLiveYtLikedVideos(likedJson.results);
            }
          }
        }

        // 3. Fetch subscription feed
        const feedRes = await fetch('/api/youtube/my-feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken }),
        });
        if (feedRes.ok) {
          const feedJson = await feedRes.json();
          if (feedJson.results && feedJson.results.length > 0) {
            setLiveSubFeed(feedJson.results);
          }
        }
      } catch (err) {
        console.warn('Failed to load live YouTube profile data:', err);
      } finally {
        setIsLoadingLiveYt(false);
      }
    };

    fetchLiveYtData();
  }, [ytProfile?.accessToken, ytProfile?.handle]);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateCollection(newFolderName.trim(), newFolderDesc.trim(), 'indigo');
    setNewFolderName('');
    setNewFolderDesc('');
    setShowCreateFolderModal(false);
  };

  // Favorites / Watch Later Podcasts
  const favoritePodcasts = podcasts.filter((p) => p.isFavorite);
  const watchLaterPodcasts = podcasts.filter((p) => p.status === 'In Progress' || p.status === 'Unread');
  const completedPodcasts = podcasts.filter((p) => p.status === 'Completed');

  // Filter logic
  const filteredPodcasts = podcasts.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === '' ||
      p.title.toLowerCase().includes(q) ||
      p.channel.toLowerCase().includes(q) ||
      p.shortSummary.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));

    let matchesFilter = true;
    if (activeFilter === 'Favorites') matchesFilter = !!p.isFavorite;
    else if (activeFilter === 'WatchLater') matchesFilter = p.status === 'In Progress' || p.status === 'Unread';
    else if (activeFilter === 'Completed') matchesFilter = p.status === 'Completed';

    let matchesCollection = true;
    if (selectedCollectionId) {
      matchesCollection = !!p.collections?.includes(selectedCollectionId);
    }

    return matchesSearch && matchesFilter && matchesCollection;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ─── Filter Bar ─── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          {/* Filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => { setActiveFilter('All'); setSelectedCollectionId(null); }}
              className={`yt-chip ${activeFilter === 'All' && !selectedCollectionId ? 'yt-chip-active' : ''}`}
            >
              All ({podcasts.length})
            </button>
            <button
              onClick={() => { setActiveFilter('Favorites'); setSelectedCollectionId(null); }}
              className={`yt-chip flex items-center gap-1 ${activeFilter === 'Favorites' ? 'yt-chip-active' : ''}`}
            >
              <Heart className={`w-3 h-3 ${activeFilter === 'Favorites' ? 'fill-white text-white' : 'text-slate-400'}`} />
              Favorites ({favoritePodcasts.length})
            </button>
            <button
              onClick={() => { setActiveFilter('WatchLater'); setSelectedCollectionId(null); }}
              className={`yt-chip flex items-center gap-1 ${activeFilter === 'WatchLater' ? 'yt-chip-active' : ''}`}
            >
              <Clock className={`w-3 h-3 ${activeFilter === 'WatchLater' ? 'text-white' : 'text-slate-400'}`} />
              Watch Later ({watchLaterPodcasts.length})
            </button>
            <button
              onClick={() => { setActiveFilter('Completed'); setSelectedCollectionId(null); }}
              className={`yt-chip flex items-center gap-1 ${activeFilter === 'Completed' ? 'yt-chip-active' : ''}`}
            >
              <CheckCircle2 className={`w-3 h-3 ${activeFilter === 'Completed' ? 'text-white' : 'text-slate-400'}`} />
              Completed ({completedPodcasts.length})
            </button>
          </div>

          {/* New Playlist */}
          <button
            onClick={() => setShowCreateFolderModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors shrink-0"
            style={{ background: '#e6f7f4', color: '#0e9478', borderColor: '#b2e4da' }}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Playlist
          </button>
        </div>
      </div>


      {/* ─── Playlists & Collections Folders Carousel ─────────────────────── */}
      {(collections.length > 0 || liveYtPlaylists.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-indigo-400" /> Playlists &amp; Study Collections ({collections.length + liveYtPlaylists.length})
            </span>
            <button
              onClick={() => onNavigateTab('collections')}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Playlists</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto py-1 scrollbar-none text-xs">
            {/* Live YouTube Playlists */}
            {liveYtPlaylists.map((ytCol) => (
              <a
                key={ytCol.id}
                href={`https://www.youtube.com/playlist?list=${ytCol.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl border border-[#2d3245] bg-[#222736] hover:bg-[#2a3042] text-[#f1f5f9] transition-all shrink-0 text-left min-w-[170px] cursor-pointer group shadow-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Tv className="w-4 h-4 text-[#00c6ff] shrink-0" />
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#00c6ff]/15 text-[#00c6ff] border border-[#00c6ff]/30">
                    {ytCol.itemCount} videos
                  </span>
                </div>
                <div className="font-bold text-xs text-white truncate group-hover:text-[#00c6ff] transition-colors">{ytCol.name}</div>
                <div className="text-[10px] text-[#94a3b8] truncate mt-0.5">
                  YouTube Playlist
                </div>
              </a>
            ))}

            {/* Custom App Playlists */}
            {collections.map((col) => {
              const count = podcasts.filter((p) => p.collections?.includes(col.id)).length;
              const isSelected = selectedCollectionId === col.id;

              return (
                <button
                  key={col.id}
                  onClick={() => {
                    if (isSelected) setSelectedCollectionId(null);
                    else {
                      setSelectedCollectionId(col.id);
                      setActiveFilter('All');
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all shrink-0 text-left min-w-[155px] cursor-pointer ${isSelected
                      ? 'bg-[#11A888] text-white border-transparent shadow-md'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-teal-500'}`} />
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {count} items
                    </span>
                  </div>
                  <div className="text-[12px] font-medium truncate">{col.name}</div>
                  <div className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                    {col.description || 'Playlist Collection'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Latest Uploads from Subscriptions Section ──────────────────── */}
      {liveSubFeed.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-500 font-medium">
              <Tv className="w-3.5 h-3.5 text-slate-400" />
              Latest Uploads ({liveSubFeed.length})
            </span>
            <button onClick={() => onNavigateTab('yt_search')} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 text-[11px] font-medium cursor-pointer">
              <span>Explore Feed</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {liveSubFeed.slice(0, 8).map((v, idx) => (
              <YouTubeVideoCard
                key={idx}
                video={{
                  videoId: v.videoId,
                  title: v.title,
                  channel: v.channel,
                  thumbnailUrl: v.thumbnailUrl,
                  duration: v.duration || '25:00',
                  publishedAt: v.publishedAt || 'Recent',
                  description: v.description,
                }}
                groups={knowledgeGroups}
                onAddToGroup={onAddVideoToGroup}
                onCreateGroup={onCreateKnowledgeGroup}
                onPlay={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank')}
                onSummarize={() => onNavigateTab('yt_search')}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Live Liked YouTube Videos Section ───────────────────────────── */}
      {liveYtLikedVideos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-500 font-medium">
              <Heart className="w-3.5 h-3.5 text-slate-400" />
              Liked Videos ({liveYtLikedVideos.length})
            </span>
            <button onClick={() => onNavigateTab('yt_search')} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 text-[11px] font-medium cursor-pointer">
              <span>Watch in Feed</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {liveYtLikedVideos.slice(0, 8).map((v, idx) => (
              <YouTubeVideoCard
                key={idx}
                video={{
                  videoId: v.videoId,
                  title: v.title,
                  channel: v.channel,
                  thumbnailUrl: v.thumbnailUrl,
                  duration: v.duration || '20:00',
                  publishedAt: v.publishedAt || 'Liked Video',
                  description: v.description,
                  isFavorite: true,
                }}
                groups={knowledgeGroups}
                onAddToGroup={onAddVideoToGroup}
                onCreateGroup={onCreateKnowledgeGroup}
                onPlay={() => window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank')}
                onSummarize={() => onNavigateTab('yt_search')}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── AI Knowledge Groups & Product Clusters Section ──────────────── */}
      {knowledgeGroups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-slate-500 font-medium">
              <Brain className="w-3.5 h-3.5 text-slate-400" />
              AI Knowledge Groups ({knowledgeGroups.length})
            </span>
            <button onClick={() => onNavigateTab('knowledge_groups')} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 text-[11px] font-medium cursor-pointer">
              <span>Manage</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {knowledgeGroups.map((g) => (
              <div
                key={g.id}
                onClick={() => onNavigateTab('knowledge_groups')}
                className="bg-white border border-slate-200 hover:border-teal-300 hover:shadow-sm rounded-xl p-3.5 space-y-2 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-medium border border-teal-200">
                    {g.category}
                  </span>
                  <span className="text-[10px] text-slate-400">{g.videoIds.length} videos</span>
                </div>
                <p className="text-[12px] font-medium text-slate-700 group-hover:text-teal-700 transition-colors line-clamp-1">{g.name}</p>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{g.description}</p>
                <div className="flex items-center gap-1 text-[11px] text-teal-600 font-medium">
                  <span>Brainstorm</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Main Podcast Summaries Grid ─────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-slate-500 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            {selectedCollectionId
              ? `Playlist: ${collections.find((c) => c.id === selectedCollectionId)?.name}`
              : `${activeFilter === 'All' ? 'All Episodes' : activeFilter}`}
            <span className="text-slate-300">({filteredPodcasts.length})</span>
          </span>
          {selectedCollectionId && (
            <button onClick={() => setSelectedCollectionId(null)} className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {filteredPodcasts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPodcasts.map((podcast) => (
              <PodcastCard
                key={podcast.id}
                podcast={podcast}
                onSelect={onSelectPodcast}
                onDelete={onDeletePodcast}
                onToggleStatus={onToggleStatus}
                onToggleFavorite={onToggleFavorite}
                knowledgeGroups={knowledgeGroups}
                onAddVideoToGroup={onAddVideoToGroup}
                onCreateKnowledgeGroup={onCreateKnowledgeGroup}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-xl space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-slate-700">No episodes here yet</h3>
              <p className="text-[12px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Import a YouTube episode or search to add videos to your library.
              </p>
            </div>
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-2 bg-[#11A888] hover:bg-[#0e9478] text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Import Episode</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Create Playlist Modal ────────────────────────────────────────── */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-teal-500" />
                New Playlist
              </h3>
              <button onClick={() => setShowCreateFolderModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. SaaS Ideas, AI Engineering"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-[13px] focus:outline-none focus:border-teal-400 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500">Description</label>
                <textarea
                  rows={2}
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  placeholder="Short description..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-[13px] focus:outline-none focus:border-teal-400 placeholder:text-slate-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowCreateFolderModal(false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[12px] font-medium cursor-pointer transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-[#11A888] hover:bg-[#0e9478] text-white rounded-lg text-[12px] font-medium cursor-pointer transition-colors">
                  Create Playlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Sign In Modal (Only shown when explicitly triggered) ──────────── */}
      {showLoginModal && (
        <GoogleSignInCard
          isModal={true}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
          }}
        />
      )}
    </div>
  );
};
