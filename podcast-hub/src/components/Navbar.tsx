import React, { useState, useEffect } from 'react';
import { ViewTab, ThemeMode } from '../types';
import { GoogleSignInCard } from './GoogleSignInCard';
import {
  LayoutDashboard,
  Lightbulb,
  ShieldCheck,
  Bot,
  PlusCircle,
  Search,
  BookOpen,
  Zap,
  TrendingUp,
  Tv,
  Folder,
  Share2,
  Sun,
  Moon,
  User,
  X,
  Sparkles,
  ExternalLink,
  Menu,
} from 'lucide-react';

interface NavbarProps {
  currentTab: ViewTab;
  setCurrentTab: (tab: ViewTab) => void;
  onOpenImport: () => void;
  onOpenLoginModal?: () => void;
  onToggleSidebar?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  stats: {
    totalPodcasts: number;
    totalMonetizationIdeas: number;
    hoursSaved: number;
    avgMastery: number;
  };
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenImport,
  onOpenLoginModal,
  onToggleSidebar,
  searchQuery,
  setSearchQuery,
  theme,
  onToggleTheme,
  stats,
}) => {
  const [ytProfile, setYtProfile] = useState<{ name: string; handle: string; avatar: string } | null>(() => {
    try {
      const saved = localStorage.getItem('user_yt_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [showYtLoginModal, setShowYtLoginModal] = useState(false);
  const [manualHandle, setManualHandle] = useState('');

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('user_yt_profile');
        setYtProfile(saved ? JSON.parse(saved) : null);
      } catch {
        setYtProfile(null);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const prof = event.data.profile || {
          name: 'YouTube Account Member',
          handle: '@youtube_user',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        };
        setYtProfile(prof);
        localStorage.setItem('user_yt_profile', JSON.stringify(prof));
        setShowYtLoginModal(false);
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('yt_profile_updated', handleSync);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('yt_profile_updated', handleSync);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleLaunchYouTubeOAuth = async () => {
    setShowYtLoginModal(true);
  };

  const handleSignOut = () => {
    setYtProfile(null);
    localStorage.removeItem('user_yt_profile');
    window.dispatchEvent(new Event('yt_profile_updated'));
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200 text-slate-800 transition-colors duration-300 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Mobile Menu & Logo Title */}
          <div className="flex items-center gap-2 select-none shrink-0">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors"
                title="Toggle Left Menu"
              >
                <Menu className="w-4 h-4 text-sky-700" />
              </button>
            )}
            <div
              className="flex items-center gap-2 sm:gap-3 cursor-pointer"
              onClick={() => setCurrentTab('dashboard')}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/25 hover:scale-105 transition-all shrink-0">
                <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5 sm:gap-2">
                  PodSummarizer{' '}
                  <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-bold uppercase tracking-wider">
                    Glance Executive
                  </span>
                </h1>
                <p className="text-xs text-slate-500 hidden md:block font-medium">
                  Learning &amp; AI Monetization Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="hidden xl:flex items-center gap-3 text-xs font-medium text-slate-600 bg-sky-50/60 px-3.5 py-1.5 rounded-lg border border-sky-100">
            <div className="flex items-center gap-1.5" title="Summarized Podcasts">
              <BookOpen className="w-3.5 h-3.5 text-sky-600" />
              <span>
                <strong className="font-semibold text-slate-900">{stats.totalPodcasts}</strong> Podcasts
              </span>
            </div>
            <div className="h-3 w-px bg-sky-200" />
            <div className="flex items-center gap-1.5" title="Monetization Opportunities">
              <Lightbulb className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span>
                <strong className="font-semibold text-slate-900">{stats.totalMonetizationIdeas}</strong> Ideas
              </span>
            </div>
            <div className="h-3 w-px bg-sky-200" />
            <div className="flex items-center gap-1.5" title="Estimated Listening Hours Saved">
              <Zap className="w-3.5 h-3.5 text-[#10b981]" />
              <span>
                <strong className="font-semibold text-slate-900">{stats.hoursSaved}h</strong> Saved
              </span>
            </div>
          </div>

          {/* Search Bar - Desktop Only */}
          <div className="hidden sm:block flex-1 min-w-0 max-w-xs sm:max-w-md relative">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim() && currentTab !== 'dashboard') {
                  setCurrentTab('dashboard');
                }
              }}
              placeholder="Search YouTube podcasts, hosts, product ideas..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 sm:pl-10 pr-8 sm:pr-10 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 font-normal"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs text-slate-500 hover:text-slate-900 font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* YouTube Sign In & Actions CTA */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!ytProfile ? (
              <button
                onClick={() => {
                  if (onOpenLoginModal) {
                    onOpenLoginModal();
                  } else {
                    setShowYtLoginModal(true);
                  }
                }}
                className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm shadow-sky-500/25 border border-sky-400 transition-all cursor-pointer shrink-0"
                title="Sign in with YouTube"
              >
                <Tv className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="hidden sm:inline">Sign in</span>
                <span className="sm:hidden text-[11px]">YouTube</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-sky-50 border border-sky-200 pl-1.5 pr-3 py-1 rounded-lg shadow-2xs shrink-0">
                <img
                  src={ytProfile.avatar}
                  alt={ytProfile.name}
                  className="w-6 h-6 rounded-md object-cover border border-sky-500 cursor-pointer shrink-0"
                  onClick={() => {
                    if (onOpenLoginModal) onOpenLoginModal();
                    else setCurrentTab('yt_search');
                  }}
                />
                <button
                  onClick={() => setCurrentTab('yt_search')}
                  className="text-xs font-bold text-slate-800 hover:text-sky-600 transition-colors hidden md:block"
                >
                  {ytProfile.name}
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-slate-400 hover:text-red-500 p-0.5 ml-1"
                  title="Sign Out"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar (Glance Design Light Chips Pattern) */}
        <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none border-t border-slate-200 text-xs sm:text-sm -mx-3 px-3 sm:mx-0 sm:px-0">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`yt-chip ${currentTab === 'dashboard' ? 'yt-chip-active' : ''}`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 inline mr-1" />
            <span>Library</span>
          </button>

          <button
            onClick={() => setCurrentTab('yt_search')}
            className={`yt-chip ${currentTab === 'yt_search' ? 'yt-chip-active' : ''}`}
          >
            <Tv className="w-3.5 h-3.5 inline mr-1 text-red-500" />
            <span>Watch YouTube</span>
          </button>

          <button
            onClick={() => setCurrentTab('knowledge_groups')}
            className={`yt-chip ${currentTab === 'knowledge_groups' ? 'yt-chip-active' : ''}`}
          >
            <Folder className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
            <span>AI Knowledge Groups</span>
          </button>

          <button
            onClick={() => setCurrentTab('monetization')}
            className={`yt-chip ${currentTab === 'monetization' ? 'yt-chip-active' : ''}`}
          >
            <Lightbulb className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
            <span>Business Ideas ({stats.totalMonetizationIdeas})</span>
          </button>

          <button
            onClick={() => setCurrentTab('ethics')}
            className={`yt-chip ${currentTab === 'ethics' ? 'yt-chip-active' : ''}`}
          >
            <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
            <span>Ethics &amp; Discipline</span>
          </button>

          <button
            onClick={() => setCurrentTab('content_studio')}
            className={`yt-chip ${currentTab === 'content_studio' ? 'yt-chip-active' : ''}`}
          >
            <Share2 className="w-3.5 h-3.5 inline mr-1 text-purple-400" />
            <span>Content Studio</span>
          </button>

          <button
            onClick={() => setCurrentTab('collections')}
            className={`yt-chip ${currentTab === 'collections' ? 'yt-chip-active' : ''}`}
          >
            <Folder className="w-3.5 h-3.5 inline mr-1 text-blue-400" />
            <span>Playlists</span>
          </button>

          <button
            onClick={() => setCurrentTab('assistant')}
            className={`yt-chip ${currentTab === 'assistant' ? 'yt-chip-active' : ''}`}
          >
            <Bot className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
            <span>AI Assistant</span>
          </button>
        </div>
      </div>
    </header>
  );
};
