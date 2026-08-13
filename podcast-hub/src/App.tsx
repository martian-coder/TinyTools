import React, { useState, useEffect } from 'react';
import { PodcastItem, ViewTab, PodcastStatus, ThemeMode, SavedCollection, UserProfile, KnowledgeGroup } from './types';
import { INITIAL_PODCASTS } from './data/initialPodcasts';
import { resolveGoogleRedirectResult } from './lib/auth';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { GoogleSignInCard } from './components/GoogleSignInCard';
import { LibraryView } from './components/LibraryView';
import { PodcastCard } from './components/PodcastCard';
import { PodcastDetailView } from './components/PodcastDetailView';
import { MonetizationHubView } from './components/MonetizationHubView';
import { EthicsHubView } from './components/EthicsHubView';
import { AIAssistantView } from './components/AIAssistantView';
import { YouTubeSearchView } from './components/YouTubeSearchView';
import { ContentStudioView } from './components/ContentStudioView';
import { CollectionsView } from './components/CollectionsView';
import { UserProfileView } from './components/UserProfileView';
import { KnowledgeGroupsView } from './components/KnowledgeGroupsView';
import {
  savePodcastsToCloud,
  loadPodcastsFromCloud,
  saveProfileToCloud,
  loadProfileFromCloud,
  saveKnowledgeGroupsToCloud,
  loadKnowledgeGroupsFromCloud,
  isSupabaseConfigured,
} from './lib/supabase';
import {
  initIndexedDb,
  dbSavePodcasts,
  dbSaveProfile,
  dbSaveCollections,
  dbSaveKnowledgeGroups,
} from './lib/db';

// Helper to get active user ID for cloud sync
const getActiveUserId = (): string => {
  try {
    const saved = localStorage.getItem('user_yt_profile');
    if (saved) {
      const p = JSON.parse(saved);
      if (p.handle || p.email || p.name) return p.handle || p.email || p.name;
    }
  } catch {}
  return 'default_user';
};
import {
  BookOpen,
  Filter,
  PlusCircle,
  Search,
  Sparkles,
  TrendingUp,
  Lightbulb,
  ShieldCheck,
  Zap,
} from 'lucide-react';

const DEFAULT_COLLECTIONS: SavedCollection[] = [
  { id: 'col-1', name: 'Monetization Models', description: 'Business blueprints & SaaS tactics', color: 'amber' },
  { id: 'col-2', name: 'AI & Automation', description: 'Agentic workflows and engineering', color: 'indigo' },
  { id: 'col-3', name: 'Mindset & Habits', description: 'Peak performance and protocols', color: 'emerald' },
];

const DEFAULT_KNOWLEDGE_GROUPS: KnowledgeGroup[] = [
  {
    id: 'g-saas',
    name: '💰 SaaS & Revenue Models',
    description: 'B2B software ideas, pricing frameworks, and monetization tactics from tech founders.',
    category: 'SaaS Products',
    videoIds: ['L_LUpnjgPso', '8S0FDjFBj8o', '3qHkcs3kG44'],
    customNotesPerVideo: {
      'L_LUpnjgPso': 'Lenny podcast on shifting from per-seat to outcome-based micro-SaaS pricing.',
      '8S0FDjFBj8o': 'YC recommendation on B2B pricing: Charge 10x value delivered.',
    },
  },
  {
    id: 'g-ai-tech',
    name: '🤖 AI Agents & Tech Stack',
    description: 'LLM agent architectures, micro-services, and automated workflows.',
    category: 'AI & Tech Stack',
    videoIds: ['L_LUpnjgPso', 'b02TIsInTmg'],
    customNotesPerVideo: {
      'L_LUpnjgPso': 'Building vertical AI wrappers with low churn.',
      'b02TIsInTmg': 'Sam Altman on autonomous agents replacing multi-step workflows.',
    },
  },
  {
    id: 'g-content',
    name: '🎬 Creator Brand & Media Growth',
    description: 'Audience acquisition, personal brand leverage, and distribution hacks.',
    category: 'Content Creation',
    videoIds: ['M576WGiDBdQ'],
  },
  {
    id: 'g-focus',
    name: '🧠 High-Performance Focus & Protocols',
    description: 'Neuroscience toolkits for deep work, dopamine management, and endurance.',
    category: 'Mindset & Growth',
    videoIds: ['gX_m3fU3e18', '3qHkcs3kG44'],
  },
];

export default function App() {
  const [podcasts, setPodcasts] = useState<PodcastItem[]>(() => {
    let list = INITIAL_PODCASTS;
    const saved = localStorage.getItem('podsummarizer_library');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      } catch (e) {
        console.error('Failed to parse saved library:', e);
      }
    }
    // Deduplicate by ID and youtubeVideoId
    const seen = new Set<string>();
    return list.filter((p) => {
      const key = p.youtubeVideoId || p.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  const DEFAULT_USER_PROFILE: UserProfile = {
    name: 'Guest User',
    role: 'AI Researcher & Podcaster',
    bio: 'Analyzing top-tier podcast insights to build scalable Micro-SaaS products and AI agent workflows.',
    strategicGoals: [
      'Build $10k/mo Micro-SaaS with AI Agents',
      'Master High-Performance Focus & Mindset Protocols',
      'Automate YouTube Podcast Summarization Workflows',
    ],
    notes: 'Key Strategy Notes:\n- Focus on solving high-friction problems with custom AI tools.\n- Leverage daily video summaries to spot market gaps before competitors.',
    savedInsights: [
      {
        id: 'ins-1',
        podcastTitle: 'How to Build a $100M SaaS (Naval Ravikant)',
        insight: 'Specific knowledge cannot be taught, but it can be learned. Combine leverage, judgment, and personal brand.',
        category: 'Monetization Tactic',
        dateAdded: '2026-08-10',
      },
      {
        id: 'ins-2',
        podcastTitle: 'Huberman Lab: Dopamine & Focus',
        insight: 'Delay morning caffeine by 90 minutes to prevent afternoon energy crashes and optimize cortisol alignment.',
        category: 'Mindset & Focus',
        dateAdded: '2026-08-09',
      },
    ],
  };

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('podsummarizer_profile');
    let base = DEFAULT_USER_PROFILE;
    if (saved) {
      try {
        base = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse profile:', e);
      }
    }
    // Check if Google sign-in profile exists
    try {
      const googleProf = localStorage.getItem('user_yt_profile');
      if (googleProf) {
        const parsedG = JSON.parse(googleProf);
        if (parsedG.name) {
          base.name = parsedG.name;
        }
      }
    } catch {}
    return base;
  });

  const [collections, setCollections] = useState<SavedCollection[]>(() => {
    const saved = localStorage.getItem('podsummarizer_collections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved collections:', e);
      }
    }
    return DEFAULT_COLLECTIONS;
  });

  const [knowledgeGroups, setKnowledgeGroups] = useState<KnowledgeGroup[]>(() => {
    const saved = localStorage.getItem('podsummarizer_knowledge_groups');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_KNOWLEDGE_GROUPS;
  });

  useEffect(() => {
    localStorage.setItem('podsummarizer_knowledge_groups', JSON.stringify(knowledgeGroups));
  }, [knowledgeGroups]);

  const handleCreateKnowledgeGroup = (name: string, description: string, category: KnowledgeGroup['category']) => {
    const newG: KnowledgeGroup = {
      id: `g-${Date.now()}`,
      name,
      description,
      category,
      videoIds: [],
    };
    setKnowledgeGroups((prev) => [...prev, newG]);
  };

  const handleDeleteKnowledgeGroup = (id: string) => {
    setKnowledgeGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const handleUpdateGroupNotes = (groupId: string, videoId: string, note: string) => {
    setKnowledgeGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          customNotesPerVideo: {
            ...(g.customNotesPerVideo || {}),
            [videoId]: note,
          },
        };
      })
    );
  };

  const handleRemoveVideoFromGroup = (groupId: string, videoId: string) => {
    setKnowledgeGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          videoIds: g.videoIds.filter((v) => v !== videoId),
        };
      })
    );
  };

  const handleAddVideoToGroup = (groupId: string, video: any) => {
    const vId = typeof video === 'string' ? video : video.videoId;
    if (!vId) return;

    setKnowledgeGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        if (g.videoIds.includes(vId)) return g;
        return {
          ...g,
          videoIds: [...g.videoIds, vId],
        };
      })
    );

    // If video object is passed, ensure it is added to podcasts library
    if (typeof video === 'object' && video.videoId) {
      setPodcasts((prev) => {
        const exists = prev.some((p) => p.youtubeVideoId === video.videoId || p.id === video.videoId);
        if (exists) return prev;
        const newP: PodcastItem = {
          id: `yt-${video.videoId}`,
          youtubeVideoId: video.videoId,
          title: video.title || 'YouTube Episode',
          channel: video.channel || 'YouTube Creator',
          thumbnailUrl: video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
          source: `https://www.youtube.com/watch?v=${video.videoId}`,
          dateAdded: new Date().toISOString().split('T')[0],
          duration: video.duration || '30m',
          status: 'Unread',
          masteryLevel: 0,
          shortSummary: video.description || `Episode from ${video.channel}`,
          detailedSummary: [],
          monetizationOpportunities: [],
          ethicsAndDiscipline: [],
          reflectionQuestions: [],
          keyTimestamps: [],
          actionableTakeaways: [],
          tags: [video.channel || 'YouTube', 'Knowledge Group'],
          userNotes: '',
          bookmarkedTimestamps: [],
        };
        return [newP, ...prev];
      });
    }
  };

  const [theme, setTheme] = useState<ThemeMode>('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [currentTab, setCurrentTab] = useState<ViewTab>(() => {
    try {
      const savedTab = localStorage.getItem('podsummarizer_current_tab');
      if (savedTab && ['dashboard', 'monetization', 'ethics', 'detail', 'assistant', 'yt_search', 'content_studio', 'collections', 'knowledge_groups', 'profile'].includes(savedTab)) {
        return savedTab as ViewTab;
      }
    } catch {}
    return 'dashboard';
  });

  const [selectedPodcast, setSelectedPodcast] = useState<PodcastItem | null>(() => {
    try {
      const savedId = localStorage.getItem('podsummarizer_selected_podcast_id');
      if (savedId && Array.isArray(INITIAL_PODCASTS)) {
        const match = INITIAL_PODCASTS.find((p) => p.id === savedId || p.youtubeVideoId === savedId);
        if (match) return match;
      }
    } catch {}
    return null;
  });

  // Sync currentTab changes to localStorage
  useEffect(() => {
    localStorage.setItem('podsummarizer_current_tab', currentTab);
  }, [currentTab]);

  // Sync selectedPodcast changes to localStorage
  useEffect(() => {
    if (selectedPodcast) {
      localStorage.setItem('podsummarizer_selected_podcast_id', selectedPodcast.youtubeVideoId || selectedPodcast.id);
    } else {
      localStorage.removeItem('podsummarizer_selected_podcast_id');
    }
  }, [selectedPodcast]);

  // Fallback: If currentTab is 'detail' but no selectedPodcast, restore first podcast or fallback to dashboard
  useEffect(() => {
    if (currentTab === 'detail' && !selectedPodcast) {
      if (podcasts.length > 0) {
        const savedId = localStorage.getItem('podsummarizer_selected_podcast_id');
        const match = podcasts.find((p) => p.id === savedId || p.youtubeVideoId === savedId);
        setSelectedPodcast(match || podcasts[0]);
      } else {
        setCurrentTab('dashboard');
      }
    }
  }, [currentTab, selectedPodcast, podcasts]);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportingFromYT, setIsImportingFromYT] = useState(false);
  const [showGlobalLoginModal, setShowGlobalLoginModal] = useState(false);

  // Filters for Library
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | PodcastStatus>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Initial IndexedDB & Cloud Sync on App boot
  useEffect(() => {
    // 1. Load from local IndexedDB (with automatic migration from localStorage)
    initIndexedDb(
      INITIAL_PODCASTS,
      DEFAULT_USER_PROFILE,
      DEFAULT_COLLECTIONS,
      DEFAULT_KNOWLEDGE_GROUPS
    ).then(({ podcasts: dbPods, profile: dbProf, collections: dbCols, groups: dbGroups }) => {
      if (dbPods && dbPods.length > 0) setPodcasts(dbPods);
      if (dbProf) setUserProfile(dbProf);
      if (dbCols && dbCols.length > 0) setCollections(dbCols);
      if (dbGroups && dbGroups.length > 0) setKnowledgeGroups(dbGroups);

      // 2. If Supabase is configured, sync with Cloud in background
      if (isSupabaseConfigured()) {
        const uid = getActiveUserId();
        loadPodcastsFromCloud(uid).then((cloudPods) => {
          if (cloudPods && cloudPods.length > 0) {
            setPodcasts((prev) => {
              const map = new Map<string, PodcastItem>();
              cloudPods.forEach((p) => map.set(p.youtubeVideoId || p.id, p));
              prev.forEach((p) => {
                const key = p.youtubeVideoId || p.id;
                if (!map.has(key)) map.set(key, p);
              });
              const merged = Array.from(map.values());
              dbSavePodcasts(merged);
              return merged;
            });
          }
        });

        loadProfileFromCloud(uid).then((cloudProf) => {
          if (cloudProf) {
            setUserProfile(cloudProf);
            dbSaveProfile(cloudProf);
          }
        });

        loadKnowledgeGroupsFromCloud(uid).then((cloudGroups) => {
          if (cloudGroups && cloudGroups.length > 0) {
            setKnowledgeGroups(cloudGroups);
            dbSaveKnowledgeGroups(cloudGroups);
          }
        });
      }
    });
  }, []);

  // Save podcasts & collections to IndexedDB, localStorage, and Cloud
  useEffect(() => {
    localStorage.setItem('podsummarizer_library', JSON.stringify(podcasts));
    dbSavePodcasts(podcasts);
    if (isSupabaseConfigured()) {
      savePodcastsToCloud(getActiveUserId(), podcasts);
    }
  }, [podcasts]);

  useEffect(() => {
    localStorage.setItem('podsummarizer_collections', JSON.stringify(collections));
    dbSaveCollections(collections);
  }, [collections]);

  useEffect(() => {
    localStorage.setItem('podsummarizer_profile', JSON.stringify(userProfile));
    dbSaveProfile(userProfile);
    if (isSupabaseConfigured()) {
      saveProfileToCloud(getActiveUserId(), userProfile);
    }
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('podsummarizer_knowledge_groups', JSON.stringify(knowledgeGroups));
    dbSaveKnowledgeGroups(knowledgeGroups);
    if (isSupabaseConfigured()) {
      saveKnowledgeGroupsToCloud(getActiveUserId(), knowledgeGroups);
    }
  }, [knowledgeGroups]);

  // Handle Google redirect sign-in result (fires once on page load after redirect)
  useEffect(() => {
    resolveGoogleRedirectResult()
      .then((prof) => {
        if (prof) {
          setUserProfile((prev) => ({ ...prev, name: prof.name }));
          window.dispatchEvent(new Event('yt_profile_updated'));
        }
      })
      .catch(() => {});
  }, []);

  // Sync Google Account profile updates
  useEffect(() => {
    const handleGoogleProfileSync = () => {
      try {
        const googleProf = localStorage.getItem('user_yt_profile');
        if (googleProf) {
          const parsedG = JSON.parse(googleProf);
          if (parsedG.name) {
            setUserProfile((prev) => ({ ...prev, name: parsedG.name }));
          }
        } else {
          setUserProfile((prev) => ({ ...prev, name: DEFAULT_USER_PROFILE.name }));
        }
      } catch {}
    };

    window.addEventListener('yt_profile_updated', handleGoogleProfileSync);
    return () => window.removeEventListener('yt_profile_updated', handleGoogleProfileSync);
  }, []);

  useEffect(() => {
    localStorage.setItem('podsummarizer_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Extract all unique tags
  const allTags = Array.from(new Set(podcasts.flatMap((p) => p.tags)));

  // Statistics calculation
  const stats = {
    totalPodcasts: podcasts.length,
    totalMonetizationIdeas: podcasts.reduce(
      (acc, p) => acc + p.monetizationOpportunities.length,
      0
    ),
    hoursSaved: Math.round(podcasts.length * 1.5),
    avgMastery: podcasts.length
      ? Math.round(
          podcasts.reduce((acc, p) => acc + (p.masteryLevel || 0), 0) / podcasts.length
        )
      : 0,
  };

  // Filter logic
  const filteredPodcasts = podcasts.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === '' ||
      p.title.toLowerCase().includes(q) ||
      p.channel.toLowerCase().includes(q) ||
      p.shortSummary.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.actionableTakeaways.some((a) => a.toLowerCase().includes(q)) ||
      p.monetizationOpportunities.some(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.model.toLowerCase().includes(q)
      ) ||
      p.ethicsAndDiscipline.some(
        (e) =>
          e.topic.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.disciplineTakeaway.toLowerCase().includes(q)
      ) ||
      p.detailedSummary.some(
        (d) =>
          d.sectionTitle.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q) ||
          d.keyPoints.some((kp) => kp.toLowerCase().includes(q))
      ) ||
      p.keyTimestamps.some(
        (ts) => ts.topic.toLowerCase().includes(q) || ts.summary.toLowerCase().includes(q)
      );

    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchesTag = selectedTag === 'All' || p.tags.includes(selectedTag);

    return matchesSearch && matchesStatus && matchesTag;
  });

  const handleAddPodcast = (newPodcast: PodcastItem) => {
    setPodcasts((prev) => [newPodcast, ...prev]);
    setSelectedPodcast(newPodcast);
    setCurrentTab('detail');
  };

  const handleImportVideoDirectly = async (
    title: string,
    sourceUrl: string,
    channel: string
  ) => {
    setIsImportingFromYT(true);
    let extractedYtId = '';
    const ytMatch = sourceUrl.match(/(?:v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/e\/|watch\?v=|^)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      extractedYtId = ytMatch[1];
    }

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          source: sourceUrl,
          channel,
          content: `YouTube Podcast Episode: "${title}". Channel: ${channel}. Source URL: ${sourceUrl}`,
        }),
      });

      const json = await response.json();
      const rawData = json.podcast || json.data;

      if (rawData) {
        const newPodcast: PodcastItem = {
          id: `yt-${Date.now()}`,
          title: rawData.title || title,
          source: sourceUrl,
          channel: channel || 'YouTube',
          thumbnailUrl: extractedYtId
            ? `https://img.youtube.com/vi/${extractedYtId}/hqdefault.jpg`
            : 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80',
          youtubeVideoId: extractedYtId,
          dateAdded: new Date().toISOString().split('T')[0],
          duration: rawData.duration || '45m',
          status: 'Unread',
          masteryLevel: 0,
          shortSummary: rawData.shortSummary || `Executive summary of "${title}" from ${channel}.`,
          detailedSummary: rawData.detailedSummary?.length
            ? rawData.detailedSummary
            : [
                {
                  sectionTitle: 'Executive Breakdown',
                  content: `A thorough analysis of ${title}, covering market opportunities, strategic frameworks, and core takeaways.`,
                  keyPoints: [
                    'Strategic positioning and leverage points',
                    'Key operational principles discussed',
                    'Target market opportunities and growth drivers',
                  ],
                },
              ],
          monetizationOpportunities: rawData.monetizationOpportunities?.length
            ? rawData.monetizationOpportunities.map((m: any, idx: number) => ({
                id: `m-${idx}-${Date.now()}`,
                ...m,
              }))
            : [
                {
                  id: `m-1-${Date.now()}`,
                  title: 'Micro-SaaS & AI Tool Opportunity',
                  description: `Building a targeted digital product based on insights from ${title}`,
                  model: 'B2B SaaS / Consulting',
                  difficulty: 'Medium',
                  potentialRevenue: '$5k - $20k / mo',
                  actionSteps: [
                    'Audit existing market solutions',
                    'Build 7-day proof-of-concept MVP',
                    'Launch to niche online communities',
                  ],
                },
              ],
          ethicsAndDiscipline: rawData.ethicsAndDiscipline?.length
            ? rawData.ethicsAndDiscipline.map((e: any, idx: number) => ({
                id: `e-${idx}-${Date.now()}`,
                ...e,
              }))
            : [
                {
                  id: `e-1-${Date.now()}`,
                  topic: 'Ethical Execution & Deep Focus',
                  summary: 'Maintaining long-term integrity while aggressively scaling digital leverage.',
                  disciplineTakeaway: 'Structure daily deep work blocks without digital noise.',
                  ethicalConsideration: 'Ensure transparent AI guardrails and user data privacy.',
                  debatePoints: ['Speed vs quality control', 'Ethics of autonomous digital agents'],
                },
              ],
          reflectionQuestions: rawData.reflectionQuestions || [],
          keyTimestamps: rawData.keyTimestamps || [
            { timestamp: '00:00', topic: 'Episode Introduction', summary: 'Overview and thesis.' },
            { timestamp: '12:30', topic: 'Tactical Strategies & Frameworks', summary: 'Core implementation steps.' },
            { timestamp: '32:10', topic: 'Monetization Roadmap', summary: 'Actionable takeaways.' },
          ],
          actionableTakeaways: rawData.actionableTakeaways || [
            'Audit current workflow inefficiencies',
            'Implement 90-minute uninterrupted focus sessions',
            'Test monetizable concepts with direct customer feedback',
          ],
          tags: rawData.tags || [channel, 'YouTube', 'Podcast'],
          userNotes: '',
          bookmarkedTimestamps: [],
        };

        handleAddPodcast(newPodcast);
        return;
      }
    } catch (err) {
      console.error('Import video error:', err);
    } finally {
      setIsImportingFromYT(false);
    }

    // Fallback if API call failed
    const fallbackPodcast: PodcastItem = {
      id: `yt-${Date.now()}`,
      title: title,
      source: sourceUrl,
      channel: channel || 'YouTube',
      thumbnailUrl: extractedYtId
        ? `https://img.youtube.com/vi/${extractedYtId}/hqdefault.jpg`
        : 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80',
      youtubeVideoId: extractedYtId,
      dateAdded: new Date().toISOString().split('T')[0],
      duration: '45m',
      status: 'Unread',
      masteryLevel: 0,
      shortSummary: `Executive summary for ${title} from ${channel}. Includes business blueprints, monetization models, and strategic takeaways.`,
      detailedSummary: [
        {
          sectionTitle: 'Executive Breakdown',
          content: `In this episode from ${channel}, the discussion focuses on actionable frameworks for business leverage, market opportunities, and discipline.`,
          keyPoints: [
            'Core strategies for market differentiation and value creation',
            'Key operational principles for sustainable growth',
            'Actionable tactics for modern founders and creators',
          ],
        },
      ],
      monetizationOpportunities: [
        {
          id: `m-fallback-1`,
          title: 'AI Automation & Micro-SaaS Product',
          description: `Productizing concepts from ${title} into a niche digital service or subscription product.`,
          model: 'B2B SaaS / Monthly Subscription',
          difficulty: 'Medium',
          potentialRevenue: '$5,000 - $20,000 / mo',
          actionSteps: [
            'Validate demand with target audience',
            'Build 1-week functional prototype',
            'Distribute via direct outreach and content marketing',
          ],
        },
      ],
      ethicsAndDiscipline: [
        {
          id: `e-fallback-1`,
          topic: 'High Performance & Integrity',
          summary: 'Balancing aggressive growth goals with ethical standards and personal mental well-being.',
          disciplineTakeaway: 'Maintain structured daily focus blocks for priority objectives.',
          ethicalConsideration: 'Deliver authentic value without misleading user expectations.',
          debatePoints: ['Speed of execution vs. quality control', 'Long-term reputation vs. short-term gains'],
        },
      ],
      reflectionQuestions: [],
      keyTimestamps: [
        { timestamp: '00:00', topic: 'Introduction & Core Thesis', summary: title },
        { timestamp: '12:30', topic: 'In-Depth Tactical Discussion', summary: 'Frameworks and execution steps.' },
        { timestamp: '32:00', topic: 'Monetization & Wrap-Up', summary: 'Key takeaways and next steps.' },
      ],
      actionableTakeaways: [
        'Apply the 80/20 rule to focus on high-impact leverage points',
        'Establish clear daily focus routines',
        'Test business ideas with rapid real-world prototypes',
      ],
      tags: [channel, 'YouTube', 'Podcast'],
      userNotes: '',
      bookmarkedTimestamps: [],
    };

    handleAddPodcast(fallbackPodcast);
  };

  const handleDeletePodcast = (id: string) => {
    if (confirm('Are you sure you want to delete this podcast summary from your dashboard?')) {
      setPodcasts((prev) => prev.filter((p) => p.id !== id));
      if (selectedPodcast?.id === id) {
        setSelectedPodcast(null);
        setCurrentTab('dashboard');
      }
    }
  };

  const handleToggleStatus = (id: string) => {
    setPodcasts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nextStatus: PodcastStatus =
            p.status === 'Completed'
              ? 'In Progress'
              : p.status === 'In Progress'
              ? 'Unread'
              : 'Completed';
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );
  };

  const handleToggleFavorite = (id: string) => {
    setPodcasts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, isFavorite: !p.isFavorite };
          if (selectedPodcast?.id === id) {
            setSelectedPodcast(updated);
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleUpdatePodcast = (updated: PodcastItem) => {
    setPodcasts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (selectedPodcast?.id === updated.id) {
      setSelectedPodcast(updated);
    }
  };

  const handleCreateCollection = (name: string, description: string, color: string) => {
    const newCol: SavedCollection = {
      id: `col-${Date.now()}`,
      name,
      description,
      color,
    };
    setCollections((prev) => [...prev, newCol]);
  };

  const handleDeleteCollection = (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen font-sans antialiased bg-[#f0f2f7] text-slate-900 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab !== 'detail') setSelectedPodcast(null);
          setCurrentTab(tab);
        }}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenLoginModal={() => setShowGlobalLoginModal(true)}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        theme={theme}
        onToggleTheme={toggleTheme}
        stats={stats}
      />

      {/* Main Side-by-Side Glance Dashboard Layout (Full Screen Width) */}
      <div className="flex w-full" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        {/* Left Vertical Navigation Sidebar (Glance Design Template) */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            if (tab !== 'detail') setSelectedPodcast(null);
            setCurrentTab(tab);
          }}
          stats={stats}
          isOpen={isSidebarOpen}
          onCloseMobile={() => setIsSidebarOpen(false)}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenLoginModal={() => setShowGlobalLoginModal(true)}
        />

        {/* Main Content View Container */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 overflow-x-hidden">
        {/* VIEW 1: LIBRARY & DASHBOARD */}
        {currentTab === 'dashboard' && (
          <LibraryView
            podcasts={podcasts}
            collections={collections}
            onSelectPodcast={(p) => {
              setSelectedPodcast(p);
              setCurrentTab('detail');
            }}
            onDeletePodcast={handleDeletePodcast}
            onToggleStatus={handleToggleStatus}
            onToggleFavorite={handleToggleFavorite}
            onCreateCollection={handleCreateCollection}
            onDeleteCollection={handleDeleteCollection}
            onOpenImport={() => setIsImportOpen(true)}
            onNavigateTab={(tab) => {
              if (tab !== 'detail') setSelectedPodcast(null);
              setCurrentTab(tab);
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            knowledgeGroups={knowledgeGroups}
            onAddVideoToGroup={handleAddVideoToGroup}
            onImportVideo={handleImportVideoDirectly}
          />
        )}

        {/* VIEW 2: YOUTUBE SEARCH & WATCH */}
        {currentTab === 'yt_search' && (
          <YouTubeSearchView
            existingPodcasts={podcasts}
            onSelectPodcast={(p) => {
              setSelectedPodcast(p);
              setCurrentTab('detail');
            }}
            onImportVideo={handleImportVideoDirectly}
            isImporting={isImportingFromYT}
            onToggleFavorite={handleToggleFavorite}
            knowledgeGroups={knowledgeGroups}
            onAddVideoToGroup={handleAddVideoToGroup}
            onCreateKnowledgeGroup={(name) => handleCreateKnowledgeGroup(name, 'Quick knowledge group', 'Custom')}
          />
        )}

        {/* VIEW 2.5: AI KNOWLEDGE GROUPS WORKSPACE */}
        {currentTab === 'knowledge_groups' && (
          <KnowledgeGroupsView
            groups={knowledgeGroups}
            podcasts={podcasts}
            onCreateGroup={handleCreateKnowledgeGroup}
            onDeleteGroup={handleDeleteKnowledgeGroup}
            onUpdateGroupNotes={handleUpdateGroupNotes}
            onRemoveVideoFromGroup={handleRemoveVideoFromGroup}
            onAddVideoToGroup={handleAddVideoToGroup}
            onSelectPodcast={(p) => {
              setSelectedPodcast(p);
              setCurrentTab('detail');
            }}
          />
        )}

        {/* VIEW 3: MONETIZATION & BUSINESS OPPORTUNITIES HUB */}
        {currentTab === 'monetization' && (
          <MonetizationHubView
            podcasts={podcasts}
            onSelectPodcast={(p) => {
              setSelectedPodcast(p);
              setCurrentTab('detail');
            }}
          />
        )}

        {/* VIEW 4: ETHICS & DISCIPLINE HUB */}
        {currentTab === 'ethics' && (
          <EthicsHubView
            podcasts={podcasts}
            onSelectPodcast={(p) => {
              setSelectedPodcast(p);
              setCurrentTab('detail');
            }}
          />
        )}

        {/* VIEW 5: CONTENT CREATION STUDIO */}
        {currentTab === 'content_studio' && <ContentStudioView podcasts={podcasts} />}

        {/* VIEW 6: PLAYLISTS & COLLECTIONS */}
        {currentTab === 'collections' && (
          <CollectionsView
            podcasts={podcasts}
            collections={collections}
            onCreateCollection={handleCreateCollection}
            onDeleteCollection={handleDeleteCollection}
            onSelectPodcast={(p) => {
              setSelectedPodcast(p);
              setCurrentTab('detail');
            }}
            onDeletePodcast={handleDeletePodcast}
            onToggleStatus={handleToggleStatus}
          />
        )}

        {/* VIEW 7: DETAIL VIEWER FOR SELECTED PODCAST */}
        {currentTab === 'detail' && selectedPodcast && (
          <PodcastDetailView
            podcast={selectedPodcast}
            onBack={() => {
              setSelectedPodcast(null);
              setCurrentTab('dashboard');
            }}
            onUpdatePodcast={handleUpdatePodcast}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* VIEW 8: AI ASSISTANT CHAT */}
        {currentTab === 'assistant' && (
          <AIAssistantView
            podcasts={podcasts}
            onSelectPodcast={(p) => {
              setSelectedPodcast(p);
              setCurrentTab('detail');
            }}
          />
        )}

        {/* VIEW 9: USER PROFILE & STRATEGY VAULT */}
        {currentTab === 'profile' && (
          <UserProfileView
            userProfile={userProfile}
            onUpdateProfile={setUserProfile}
            podcasts={podcasts}
            onSelectPodcast={(p) => {
              setSelectedPodcast(p);
              setCurrentTab('detail');
            }}
          />
        )}
      </main>
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onAddPodcast={handleAddPodcast}
      />

      {/* Global Sign In Modal */}
      {showGlobalLoginModal && (
        <GoogleSignInCard
          isModal={true}
          onClose={() => setShowGlobalLoginModal(false)}
          onSuccess={() => setShowGlobalLoginModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-950 dark:bg-slate-950 light:bg-slate-200 border-t border-slate-800 dark:border-slate-800 light:border-slate-300 py-6 text-slate-500 light:text-slate-600 text-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-medium dark:text-slate-300 light:text-slate-800">
              PodSummarizer Pro AI — Executive Podcast Intelligence Dashboard
            </span>
          </div>
          <p className="text-[11px] text-slate-500 light:text-slate-600">
            Powered by Gemini 3.6 Flash • Embedded Video & Content Studio Ready
          </p>
        </div>
      </footer>
    </div>
  );
}
