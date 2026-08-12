import React from 'react';
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
  Sparkles,
  BookOpen,
  Zap,
  ChevronRight,
  BarChart3,
  Flame,
  Layers,
  X,
} from 'lucide-react';

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
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  stats,
  isOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      category: 'MAIN NAVIGATION',
      items: [
        {
          id: 'dashboard' as ViewTab,
          label: 'Dashboard & Library',
          icon: LayoutDashboard,
          badge: `${stats.totalPodcasts}`,
          badgeColor: 'bg-sky-100 text-sky-700',
        },
        {
          id: 'yt_search' as ViewTab,
          label: 'Watch & Search YouTube',
          icon: Tv,
          badge: 'Live',
          badgeColor: 'bg-red-100 text-red-600 font-bold',
        },
      ],
    },
    {
      category: 'AI & MONETIZATION',
      items: [
        {
          id: 'knowledge_groups' as ViewTab,
          label: 'AI Knowledge Groups',
          icon: Layers,
        },
        {
          id: 'monetization' as ViewTab,
          label: 'Monetization Ideas',
          icon: Lightbulb,
          badge: `${stats.totalMonetizationIdeas}`,
          badgeColor: 'bg-amber-100 text-amber-700',
        },
        {
          id: 'ethics' as ViewTab,
          label: 'Ethics & Discipline',
          icon: ShieldCheck,
        },
        {
          id: 'content_studio' as ViewTab,
          label: 'Content Studio',
          icon: Share2,
        },
        {
          id: 'assistant' as ViewTab,
          label: 'AI Copilot Assistant',
          icon: Bot,
          badge: 'AI',
          badgeColor: 'bg-sky-500 text-white',
        },
      ],
    },
    {
      category: 'ORGANIZATION',
      items: [
        {
          id: 'collections' as ViewTab,
          label: 'Playlists & Collections',
          icon: Folder,
        },
        {
          id: 'profile' as ViewTab,
          label: 'My Profile & Goals',
          icon: User,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Glance Left Sidebar Panel */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 xl:w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
          {/* Sidebar Top Brand Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => {
                setCurrentTab('dashboard');
                if (onCloseMobile) onCloseMobile();
              }}
            >
              <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/25 border border-sky-400 shrink-0">
                <Tv className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight leading-none flex items-center gap-1.5">
                  PodSummarizer
                </h2>
                <span className="text-[10px] text-sky-600 font-bold tracking-wider uppercase">
                  Glance Admin Panel
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links Grouped */}
          <div className="p-3 space-y-6 flex-1">
            {navItems.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-1.5">
                <h3 className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                  {group.category}
                </h3>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentTab(item.id);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer group ${
                          isActive
                            ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/25 border border-sky-400'
                            : 'text-slate-700 hover:bg-sky-50 hover:text-sky-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                              isActive ? 'text-white' : 'text-slate-500 group-hover:text-sky-600'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold shrink-0 ml-1 ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : item.badgeColor || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar Footer Widget */}
          <div className="p-3.5 m-3 rounded-xl bg-sky-50 border border-sky-100 space-y-2">
            <div className="flex items-center gap-2 text-sky-900 text-xs font-bold">
              <Zap className="w-4 h-4 text-sky-600 fill-sky-600" />
              <span>Podcast Intelligence</span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              Auto-summarized transcripts &amp; monetization blueprints.
            </p>
            <div className="pt-1 flex items-center justify-between text-[11px] font-bold text-sky-700 border-t border-sky-200/60">
              <span>Saved Time</span>
              <span className="text-slate-900">{stats.hoursSaved} hrs</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
