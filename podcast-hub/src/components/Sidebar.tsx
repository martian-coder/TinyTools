import React, { useState, useEffect } from 'react';
import { ViewTab } from '../types';
import {
  LayoutDashboard,
  Tv,
  Folder,
  Lightbulb,
  ShieldCheck,
  Share2,
  Bot,
  User,
  Zap,
  Layers,
  X,
  ChevronRight,
  ChevronDown,
  PlusCircle,
  LogIn,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { GoogleSignInCard } from './GoogleSignInCard';

interface SidebarProps {
  currentTab: ViewTab;
  setCurrentTab: (tab: ViewTab) => void;
  stats: {
    totalPodcasts: number;
    totalMonetizationIdeas: number;
    hoursSaved: number;
  };
  isOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenImport?: () => void;
  onOpenLoginModal?: () => void;
}

/* ── Nav groups with optional sub-items ──────────────────────────────── */
const makeNavGroups = (totalIdeas: number) => [
  {
    category: 'MAIN',
    items: [
      { id: 'dashboard'       as ViewTab, label: 'Dashboard',          icon: LayoutDashboard },
      {
        id: 'yt_search'       as ViewTab, label: 'Watch & Search',      icon: Tv,
        badge: 'Live', badgeTeal: true,
      },
    ],
  },
  {
    category: 'AI & TOOLS',
    items: [
      { id: 'knowledge_groups' as ViewTab, label: 'Knowledge Groups',  icon: Layers },
      {
        id: 'monetization'    as ViewTab, label: 'Monetization Ideas',  icon: Lightbulb,
        badge: `${totalIdeas}`, badgeAmber: true,
      },
      { id: 'ethics'          as ViewTab, label: 'Ethics & Discipline', icon: ShieldCheck },
      { id: 'content_studio'  as ViewTab, label: 'Content Studio',     icon: Share2 },
      { id: 'assistant'       as ViewTab, label: 'AI Copilot',          icon: Bot,
        badge: 'AI', badgeGreen: true,
      },
    ],
  },
  {
    category: 'ORGANIZE',
    items: [
      { id: 'collections'     as ViewTab, label: 'Playlists',           icon: Folder },
      { id: 'profile'         as ViewTab, label: 'Profile & Goals',     icon: User },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  stats,
  isOpen = false,
  onCloseMobile,
  onOpenImport,
  onOpenLoginModal,
}) => {
  const navGroups = makeNavGroups(stats.totalMonetizationIdeas);

  /* ── YouTube / Google profile from localStorage ──────────────────── */
  const [ytProfile, setYtProfile] = useState<{ name: string; handle: string; avatar: string } | null>(() => {
    try {
      const saved = localStorage.getItem('user_yt_profile');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [showLoginCard, setShowLoginCard] = useState(false);

  useEffect(() => {
    const onUpdate = () => {
      try {
        const saved = localStorage.getItem('user_yt_profile');
        setYtProfile(saved ? JSON.parse(saved) : null);
      } catch { setYtProfile(null); }
    };
    window.addEventListener('yt_profile_updated', onUpdate);
    return () => window.removeEventListener('yt_profile_updated', onUpdate);
  }, []);

  const handleSignOut = () => {
    setYtProfile(null);
    localStorage.removeItem('user_yt_profile');
    window.dispatchEvent(new Event('yt_profile_updated'));
  };

  const navigate = (tab: ViewTab) => {
    setCurrentTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  /* ── Item rendering ────────────────────────────────────────────────── */
  const NavItem = ({ item }: { item: any }) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;
    return (
      <button
        onClick={() => navigate(item.id)}
        className="w-full flex items-center justify-between px-3 py-[7px] rounded-md text-[13px] font-normal transition-colors duration-100 cursor-pointer"
        style={
          isActive
            ? { background: '#11A888', color: '#fff' }
            : { color: '#b8c5d6', background: 'transparent' }
        }
        onMouseEnter={e => { if (!isActive) { (e.currentTarget as any).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as any).style.color = '#fff'; } }}
        onMouseLeave={e => { if (!isActive) { (e.currentTarget as any).style.background = 'transparent'; (e.currentTarget as any).style.color = '#b8c5d6'; } }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="w-[15px] h-[15px] shrink-0" style={{ color: isActive ? '#fff' : '#6b84a0', opacity: 0.9 }} />
          <span className="truncate leading-snug">{item.label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.badge && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
              style={
                isActive               ? { background: 'rgba(255,255,255,0.22)', color: '#fff' }
                : item.badgeTeal       ? { background: '#0C8F8F', color: '#fff' }
                : item.badgeGreen      ? { background: '#47D378', color: '#fff' }
                : item.badgeAmber      ? { background: '#d97706', color: '#fff' }
                : { background: 'rgba(255,255,255,0.12)', color: '#b8c5d6' }
              }
            >
              {item.badge}
            </span>
          )}
          {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onCloseMobile} />
      )}

      {/*
        Glance Dark Navy Sidebar
        bg: #2c3349, active: #11A888, hover: rgba(255,255,255,0.07)
        Sticky below navbar (top: 4rem = 64px), full remaining height
      */}
      <aside
        className={`
          fixed lg:sticky
          top-0 lg:top-16
          left-0 z-40
          w-60 xl:w-64
          h-screen lg:h-[calc(100vh-4rem)]
          flex flex-col
          shrink-0 select-none
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: '#2c3349', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* ── Mobile close strip ── */}
        <div className="flex items-center justify-between px-4 py-3 lg:hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-white text-sm font-medium">Menu</span>
          <button onClick={onCloseMobile} className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>



        {/* ── Import button ── */}
        {onOpenImport && (
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => { if (onOpenImport) onOpenImport(); if (onCloseMobile) onCloseMobile(); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer"
              style={{ background: '#11A888', color: '#fff' }}
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Import Podcast</span>
            </button>
          </div>
        )}

        {/* ── Scrollable navigation ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4 custom-scrollbar">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#4a5a72' }}>
                {group.category}
              </p>
              <div className="space-y-px px-2">
                {group.items.map((item: any) => <NavItem key={item.id} item={item} />)}
              </div>
            </div>
          ))}
        </div>

        {/* ── Stats footer ── */}
        <div className="px-3 pb-4">
          <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: '#11A888' }} />
              <span className="text-[12px] font-medium" style={{ color: '#b8c5d6' }}>Intelligence</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <span style={{ color: '#4a5a72' }}>Episodes</span>
              <span className="text-right font-semibold" style={{ color: '#47D378' }}>{stats.totalPodcasts}</span>
              <span style={{ color: '#4a5a72' }}>Ideas</span>
              <span className="text-right font-semibold" style={{ color: '#F7C069' }}>{stats.totalMonetizationIdeas}</span>
              <span style={{ color: '#4a5a72' }}>Hours saved</span>
              <span className="text-right font-semibold" style={{ color: '#11A888' }}>{stats.hoursSaved}h</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Sign In modal if triggered from sidebar */}
      {showLoginCard && (
        <GoogleSignInCard
          isModal={true}
          onClose={() => setShowLoginCard(false)}
          onSuccess={() => setShowLoginCard(false)}
        />
      )}
    </>
  );
};
