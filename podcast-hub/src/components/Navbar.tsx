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
    <header className="sticky top-0 z-30 text-white shadow-md transition-colors duration-300" style={{ background: '#364155', height: '4rem' }}>
      <div className="w-full px-3 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full gap-2 sm:gap-4">
          {/* Mobile Menu & Logo Title */}
          <div className="flex items-center gap-2 select-none shrink-0">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-2 rounded-md hover:bg-white/10 transition-colors"
                title="Toggle Left Menu"
              >
                <Menu className="w-4 h-4 text-white" />
              </button>
            )}
            <div
              className="flex items-center gap-2 sm:gap-3 cursor-pointer"
              onClick={() => setCurrentTab('dashboard')}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#11A888' }}>
                <Tv className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white flex items-center gap-2">
                  PodSummarizer
                  <span className="text-[9px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider" style={{ background: 'rgba(17,168,136,0.25)', color: '#47D378' }}>
                    Glance
                  </span>
                </h1>
                <p className="text-[11px] hidden md:block" style={{ color: '#8ca0c0' }}>
                  AI Podcast Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" style={{ color: '#11A888' }} />
              <span style={{ color: '#c8cfe0' }}><strong className="text-white">{stats.totalPodcasts}</strong> Podcasts</span>
            </div>
            <div className="h-3 w-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" style={{ color: '#F7C069' }} />
              <span style={{ color: '#c8cfe0' }}><strong className="text-white">{stats.totalMonetizationIdeas}</strong> Ideas</span>
            </div>
            <div className="h-3 w-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" style={{ color: '#47D378' }} />
              <span style={{ color: '#c8cfe0' }}><strong className="text-white">{stats.hoursSaved}h</strong> Saved</span>
            </div>
          </div>

          {/* Search Bar - Desktop Only */}
          <div className="hidden sm:block flex-1 min-w-0 max-w-xs sm:max-w-md relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8ca0c0' }} />
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
              placeholder="Search podcasts, hosts, topics..."
              className="w-full rounded-lg pl-9 pr-8 py-2 text-sm font-normal focus:outline-none focus:ring-2 transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium hover:text-white"
                style={{ color: '#8ca0c0' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Profile — right corner, no background box */}
          <div className="flex items-center gap-2 shrink-0">
            {!ytProfile ? (
              <button
                onClick={() => { if (onOpenLoginModal) onOpenLoginModal(); else setShowYtLoginModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                style={{ background: 'rgba(17,168,136,0.18)', color: '#47D378', border: '1px solid rgba(17,168,136,0.3)' }}
              >
                <Tv className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <img
                  src={ytProfile.avatar}
                  alt={ytProfile.name}
                  className="w-7 h-7 rounded-full object-cover cursor-pointer shrink-0"
                  style={{ border: '2px solid #11A888' }}
                  onClick={() => { if (onOpenLoginModal) onOpenLoginModal(); else setCurrentTab('yt_search'); }}
                />
                <span
                  className="text-[13px] font-medium hidden md:block cursor-pointer truncate max-w-[120px]"
                  style={{ color: '#c8cfe0' }}
                  onClick={() => setCurrentTab('yt_search')}
                >
                  {ytProfile.name}
                </span>
                <button
                  onClick={handleSignOut}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  style={{ color: '#6b84a0' }}
                  title="Sign Out"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
