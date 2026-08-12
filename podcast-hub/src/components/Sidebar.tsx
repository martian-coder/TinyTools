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
  Zap,
  Layers,
  X,
  Compass,
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
      category: 'NAVIGATION',
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
          badgeColor: 'bg-red-100 text-red-600 font-semibold',
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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Glance Light Soft Grey Sidebar Panel */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 xl:w-72 bg-[#f3f4f6] border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
          {/* Sidebar Top Section Label (Removed Repeated App Title) */}
          <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between bg-[#e5e7eb]/40 text-slate-500 text-xs font-medium font-mono">
            <div className="flex items-center gap-2 text-slate-600">
              <Compass className="w-4 h-4 text-sky-600" />
              <span className="font-semibold uppercase tracking-wider text-[11px]">Menu Navigation</span>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links Grouped with Clean Easy-To-Read Non-Bold Fonts */}
          <div className="p-3 space-y-5 flex-1">
            {navItems.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-1">
                <h3 className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest font-mono">
                  {group.category}
                </h3>

                <div className="space-y-0.5 pt-0.5">
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer group ${
                          isActive
                            ? 'bg-sky-500 text-white shadow-2xs font-semibold border border-sky-400'
                            : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                              isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-600'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0 ml-1 ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : item.badgeColor || 'bg-slate-200/70 text-slate-600'
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
          <div className="p-3 m-3 rounded-lg bg-white border border-slate-200/80 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-slate-800 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-sky-600 fill-sky-600" />
              <span>Podcast Intelligence</span>
            </div>
            <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
              Auto-summarized transcripts &amp; monetization blueprints.
            </p>
            <div className="pt-1 flex items-center justify-between text-[11px] font-medium text-slate-600 border-t border-slate-100">
              <span>Saved Time</span>
              <span className="text-slate-900 font-semibold">{stats.hoursSaved} hrs</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
