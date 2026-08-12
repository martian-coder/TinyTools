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
} from 'lucide-react';

interface NavbarProps {
  currentTab: ViewTab;
  setCurrentTab: (tab: ViewTab) => void;
  onOpenImport: () => void;
  onOpenLoginModal?: () => void;
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
    <header className="sticky top-0 z-30 bg-[#1d2130]/95 backdrop-blur-xl border-b border-[#2d3245] text-[#f1f5f9] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Logo & App Title */}
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none shrink-0"
            onClick={() => setCurrentTab('dashboard')}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-r from-[#5b51d8] to-[#00c6ff] flex items-center justify-center text-white shadow-lg shadow-[#5b51d8]/30 hover:scale-105 transition-all shrink-0">
              <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 sm:gap-2">
                PodSummarizer{' '}
                <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-[#5b51d8]/20 text-[#00c6ff] border border-[#5b51d8]/40 font-bold uppercase tracking-wider">
                  Glance Executive
                </span>
              </h1>
              <p className="text-xs text-[#94a3b8] hidden md:block font-medium">
                Learning &amp; AI Monetization Intelligence
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="hidden xl:flex items-center gap-3 text-xs font-medium text-[#94a3b8] bg-[#222736] px-3.5 py-1.5 rounded-xl border border-[#2d3245]">
            <div className="flex items-center gap-1.5" title="Summarized Podcasts">
              <BookOpen className="w-3.5 h-3.5 text-[#5b51d8]" />
              <span>
                <strong className="font-semibold text-white">{stats.totalPodcasts}</strong> Podcasts
              </span>
            </div>
            <div className="h-3 w-px bg-[#2d3245]" />
            <div className="flex items-center gap-1.5" title="Monetization Opportunities">
              <Lightbulb className="w-3.5 h-3.5 text-[#f39c12]" />
              <span>
                <strong className="font-semibold text-white">{stats.totalMonetizationIdeas}</strong> Ideas
              </span>
            </div>
            <div className="h-3 w-px bg-[#2d3245]" />
            <div className="flex items-center gap-1.5" title="Estimated Listening Hours Saved">
              <Zap className="w-3.5 h-3.5 text-[#2ecc71]" />
              <span>
                <strong className="font-semibold text-white">{stats.hoursSaved}h</strong> Saved
              </span>
            </div>
          </div>

          {/* Search Bar - Desktop Only */}
          <div className="hidden sm:block flex-1 min-w-0 max-w-xs sm:max-w-md relative">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#64748b] absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2" />
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
              className="w-full bg-[#141721] border border-[#2d3245] rounded-xl pl-8 sm:pl-10 pr-8 sm:pr-10 py-1.5 sm:py-2 text-xs sm:text-sm text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#00c6ff] font-normal"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs text-[#94a3b8] hover:text-white font-semibold"
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
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#5b51d8] to-[#00c6ff] hover:opacity-90 text-white px-4 py-1.5 rounded-xl text-xs font-extrabold shadow-md shadow-[#5b51d8]/30 transition-all cursor-pointer shrink-0"
                title="Sign in with YouTube"
              >
                <Tv className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="hidden sm:inline">Sign in</span>
                <span className="sm:hidden text-[11px]">YouTube</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-[#212121] border border-[#272727] pl-1.5 pr-3 py-1 rounded-full shadow-xs shrink-0">
                <img
                  src={ytProfile.avatar}
                  alt={ytProfile.name}
                  className="w-6 h-6 rounded-full object-cover border border-[#3ea6ff] cursor-pointer shrink-0"
                  onClick={() => {
                    if (onOpenLoginModal) onOpenLoginModal();
                    else setCurrentTab('yt_search');
                  }}
                />
                <button
                  onClick={() => setCurrentTab('yt_search')}
                  className="text-xs font-bold text-white hover:text-[#3ea6ff] transition-colors hidden md:block"
                >
                  {ytProfile.name}
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-slate-400 hover:text-red-400 p-0.5 ml-1"
                  title="Sign Out"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar (YouTube Chips Pattern) */}
        <div className="flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none border-t border-[#272727] text-xs sm:text-sm -mx-3 px-3 sm:mx-0 sm:px-0">
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
