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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ─── YouTube-Style Header / Account Section ──────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {ytProfile ? (
              <div className="relative shrink-0">
                <img
                  src={ytProfile.avatar}
                  alt={ytProfile.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-red-500 shadow-xl shadow-red-500/20"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ytProfile.name)}&background=ef4444&color=fff&size=200&bold=true`;
                  }}
                />
                <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </span>
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                <User className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
            )}

            <div className="space-y-1">
              {ytProfile ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {ytProfile.name}
                    </h1>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ⚡ Live Auto-Sync Active
                    </span>
                  </div>
                  <p className="text-xs text-red-400 font-semibold">{ytProfile.handle}</p>
                  <p className="text-xs text-slate-400">
                    Manage your saved podcast playlists, favorites, and watch history
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    My YouTube Library &amp; Podcasts
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Sign in to sync your YouTube subscriptions, saved playlists, and watch history
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {ytProfile ? (
              <>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Refresh Google OAuth connection to sync latest YouTube playlists"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Sync Account</span>
                </button>
                <button
                  onClick={() => onNavigateTab('yt_search')}
                  className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-red-600/30 cursor-pointer"
                >
                  <Tv className="w-4 h-4 text-white" />
                  <span>Watch Feed</span>
                </button>
                <button
                  onClick={onOpenImport}
                  className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-amber-300" />
                  <span>Import Podcast</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-red-600/30 cursor-pointer"
                >
                  <Tv className="w-4 h-4 text-white" />
                  <span>Sign in with Google</span>
                </button>
                <button
                  onClick={onOpenImport}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border border-slate-700"
                >
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  <span>Import Podcast</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Library Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="text-slate-400 font-medium">Total Saved</div>
            <div className="text-lg font-bold text-white mt-0.5">{podcasts.length} Episodes</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="text-slate-400 font-medium">Favorites</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">{favoritePodcasts.length} Podcasts</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="text-slate-400 font-medium">Watch Later</div>
            <div className="text-lg font-bold text-indigo-400 mt-0.5">{watchLaterPodcasts.length} Pending</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <div className="text-slate-400 font-medium">Playlists</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{collections.length} Folders</div>
          </div>
        </div>
      </div>

      {/* ─── YouTube-Style Filter Pills ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none text-xs font-medium">
          <button
            onClick={() => {
              setActiveFilter('All');
              setSelectedCollectionId(null);
            }}
            className={`px-4 py-2 rounded-2xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'All' && !selectedCollectionId
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All History ({podcasts.length})
          </button>
          <button
            onClick={() => {
              setActiveFilter('Favorites');
              setSelectedCollectionId(null);
            }}
            className={`px-4 py-2 rounded-2xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'Favorites'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Favorites ({favoritePodcasts.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveFilter('WatchLater');
              setSelectedCollectionId(null);
            }}
            className={`px-4 py-2 rounded-2xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'WatchLater'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Watch Later ({watchLaterPodcasts.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveFilter('Completed');
              setSelectedCollectionId(null);
            }}
            className={`px-4 py-2 rounded-2xl font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'Completed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completed ({completedPodcasts.length})</span>
          </button>
        </div>

        <button
          onClick={() => setShowCreateFolderModal(true)}
          className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <FolderPlus className="w-4 h-4" />
          <span>+ New Playlist</span>
        </button>
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
                className="p-3.5 rounded-2xl border border-red-500/30 bg-red-950/20 hover:bg-red-950/40 text-slate-200 transition-all shrink-0 text-left min-w-[170px] cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Tv className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30">
                    {ytCol.itemCount} videos
                  </span>
                </div>
                <div className="font-bold text-xs truncate group-hover:text-red-400 transition-colors">{ytCol.name}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
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
                  className={`p-3.5 rounded-2xl border transition-all shrink-0 text-left min-w-[170px] cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg'
                      : 'bg-slate-900 hover:bg-slate-850 text-slate-200 border-slate-800 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Folder className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-400'}`} />
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}>
                      {count} items
                    </span>
                  </div>
                  <div className="font-bold text-xs truncate">{col.name}</div>
                  <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
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
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-red-500 fill-red-500" />
              Latest Uploads from Subscriptions ({liveSubFeed.length})
            </span>
            <button
              onClick={() => onNavigateTab('yt_search')}
              className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Explore All Feed</span>
              <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              Latest from Profile &amp; Liked Videos ({liveYtLikedVideos.length})
            </span>
            <button
              onClick={() => onNavigateTab('yt_search')}
              className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Watch in Feed</span>
              <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-400" />
              AI Knowledge Groups &amp; Product Clusters ({knowledgeGroups.length})
            </span>
            <button
              onClick={() => onNavigateTab('knowledge_groups')}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Groups &amp; AI Brainstorm</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {knowledgeGroups.map((g) => (
              <div
                key={g.id}
                onClick={() => onNavigateTab('knowledge_groups')}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-2 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                    {g.category}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 font-bold">
                    {g.videoIds.length} videos
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                  {g.name}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {g.description}
                </p>
                <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-indigo-400 group-hover:text-indigo-300">
                  <span>Brainstorm with AI</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Main Podcast Summaries Grid ─────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            {selectedCollectionId
              ? `Playlist: ${collections.find((c) => c.id === selectedCollectionId)?.name}`
              : `${activeFilter} Summaries`}
            ({filteredPodcasts.length})
          </span>
          {selectedCollectionId && (
            <button
              onClick={() => setSelectedCollectionId(null)}
              className="text-xs text-red-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear Filter
            </button>
          )}
        </div>

        {filteredPodcasts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
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
          <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-sm">
            <BookOpen className="w-12 h-12 text-indigo-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                No podcasts in this view yet
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Explore popular topics, search YouTube, or import new video episodes to build your learning library.
              </p>
            </div>
            <button
              onClick={onOpenImport}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>Import Podcast Now</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Create Playlist Modal ────────────────────────────────────────── */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-400" />
                Create New Playlist
              </h3>
              <button
                onClick={() => setShowCreateFolderModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4 text-xs">
              <div className="space-y-1 text-left">
                <label className="font-semibold text-slate-400">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. SaaS Monetization, AI Engineering"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="font-semibold text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  placeholder="Short description of what goes into this playlist..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateFolderModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
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
