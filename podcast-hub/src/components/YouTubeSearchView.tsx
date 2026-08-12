import React, { useState, useEffect } from 'react';
import { PodcastItem, YouTubeSearchResult, KnowledgeGroup } from '../types';
import { EmbeddedYouTubePlayer } from './EmbeddedYouTubePlayer';
import { VideoThumbnail } from './VideoThumbnail';
import { EpisodeChatbot } from './EpisodeChatbot';
import { GoogleSignInCard } from './GoogleSignInCard';
import { YouTubeVideoCard } from './YouTubeVideoCard';
import {
  Search,
  Play,
  Sparkles,
  Bookmark,
  Check,
  Tv,
  Clock,
  ArrowRight,
  TrendingUp,
  Heart,
  Bot,
  Brain,
  LayoutGrid,
  List,
  X,
  Share2,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
} from 'lucide-react';

interface YouTubeSearchViewProps {
  onImportVideo: (title: string, sourceUrl: string, channel: string) => Promise<void>;
  isImporting: boolean;
  existingPodcasts?: PodcastItem[];
  onSelectPodcast?: (podcast: PodcastItem) => void;
  onToggleFavorite?: (id: string) => void;
  knowledgeGroups?: KnowledgeGroup[];
  onAddVideoToGroup?: (groupId: string, video: any) => void;
  onCreateKnowledgeGroup?: (name: string) => void;
}

const DEFAULT_YOUTUBE_VIDEOS: YouTubeSearchResult[] = [
  {
    videoId: 'M576WGiDBdQ',
    title: 'Jeff Bezos on Amazon, Blue Origin, AI & Future of Technology',
    channel: 'Lex Fridman Podcast #400',
    duration: '3h 52m',
    thumbnailUrl: 'https://img.youtube.com/vi/M576WGiDBdQ/hqdefault.jpg',
    description:
      'Jeff Bezos shares rare insights on leadership principles, decision-making frameworks, space exploration, and building scalable engineering cultures.',
    publishedAt: '2026-02-10',
  },
  {
    videoId: 'gX_m3fU3e18',
    title: 'Dr. Andrew Huberman: Protocols for Peak Focus, Discipline & Energy',
    channel: 'Huberman Lab',
    duration: '1h 52m',
    thumbnailUrl: 'https://img.youtube.com/vi/gX_m3fU3e18/hqdefault.jpg',
    description:
      'Neurobiological toolkits for deep focus, managing dopamine baselines, optimizing circadian rhythms, and maintaining mental endurance.',
    publishedAt: '2026-02-08',
  },
  {
    videoId: '8S0FDjFBj8o',
    title: 'How to Build, Monetize & Scale SaaS Startups in 2026',
    channel: 'Y Combinator',
    duration: '48m 12s',
    thumbnailUrl: 'https://img.youtube.com/vi/8S0FDjFBj8o/hqdefault.jpg',
    description:
      'A practical guide from Y Combinator partners on finding product-market fit, pricing software, and acquiring B2B customers fast.',
    publishedAt: '2026-02-02',
  },
  {
    videoId: 'b02TIsInTmg',
    title: 'Sam Altman on OpenAI, GPT-5, AI Agents & Future Wealth',
    channel: 'Lex Fridman Podcast #419',
    duration: '2h 15m',
    thumbnailUrl: 'https://img.youtube.com/vi/b02TIsInTmg/hqdefault.jpg',
    description:
      'Sam Altman discusses the trajectory of autonomous AI agents, economic transformation, labor automation, and compute scaling.',
    publishedAt: '2026-01-28',
  },
];

const DEFAULT_SUBSCRIPTIONS = [
  {
    id: 'sub-1',
    channelId: 'UCAL3JXZSzSm8AlZyD3nQdBA',
    title: 'Lex Fridman',
    description: 'AI, Science, Technology & Philosophy',
    thumbnail: 'https://img.youtube.com/vi/M576WGiDBdQ/hqdefault.jpg',
  },
  {
    id: 'sub-2',
    channelId: 'UC2D2CMWXMOVWx7giW1n3LIg',
    title: 'Huberman Lab',
    description: 'Neuroscience, Focus & High Performance Protocols',
    thumbnail: 'https://img.youtube.com/vi/gX_m3fU3e18/hqdefault.jpg',
  },
  {
    id: 'sub-3',
    channelId: 'UCvjjWvA-C0g9F-dC_uXzK7w',
    title: 'Y Combinator',
    description: 'SaaS, Startups, Monetization & Founders',
    thumbnail: 'https://img.youtube.com/vi/8S0FDjFBj8o/hqdefault.jpg',
  },
  {
    id: 'sub-4',
    channelId: 'UC1T2j6g9nK8kZ8K9sR1jK0w',
    title: 'Naval Ravikant',
    description: 'Wealth, Leverage, Specific Knowledge & Mindset',
    thumbnail: 'https://img.youtube.com/vi/3qHkcs3kG44/hqdefault.jpg',
  },
  {
    id: 'sub-5',
    channelId: 'UCBv_0q-JZuJ2u5YQk055g8w',
    title: 'All-In Podcast',
    description: 'Tech, Venture Capital, Macro Economy & Business',
    thumbnail: 'https://img.youtube.com/vi/f33m-1o2c8E/hqdefault.jpg',
  },
  {
    id: 'sub-6',
    channelId: 'UCg3u1D-s5g0n3tZ5f04j29w',
    title: 'The Diary Of A CEO',
    description: 'Entrepreneurship, Personal Branding & Media',
    thumbnail: 'https://img.youtube.com/vi/b28A_sC8b1A/hqdefault.jpg',
  },
  {
    id: 'sub-7',
    channelId: 'UC4tQ2z1n5s04g03nJ05k61w',
    title: 'My First Million',
    description: 'Micro-SaaS Product Ideas & Business Growth',
    thumbnail: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'sub-8',
    channelId: 'UC5q0z55-dC04j02k501j62w',
    title: 'Tim Ferriss',
    description: 'Deconstructing Peak Performance & Tactics',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  },
];

export const YouTubeSearchView: React.FC<YouTubeSearchViewProps> = ({
  onImportVideo,
  isImporting,
  existingPodcasts = [],
  onSelectPodcast,
  onToggleFavorite,
  knowledgeGroups = [],
  onAddVideoToGroup,
  onCreateKnowledgeGroup,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOption, setSortOption] = useState<'latest' | 'relevant' | 'duration_desc' | 'duration_asc'>('latest');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string | null>(null);
  const [newChannelInput, setNewChannelInput] = useState('');
  const [showAddChannelInput, setShowAddChannelInput] = useState(false);
  const [importingVideoId, setImportingVideoId] = useState<string | null>(null);

  const subsContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollSubsLeft = () => {
    if (subsContainerRef.current) {
      subsContainerRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollSubsRight = () => {
    if (subsContainerRef.current) {
      subsContainerRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const el = subsContainerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);
  const [ytApiKey, setYtApiKey] = useState<string>(() => {
    return localStorage.getItem('user_yt_api_key') || '';
  });
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [isLiveApi, setIsLiveApi] = useState(false);
  const [connectedProfile, setConnectedProfile] = useState<{ name: string; handle: string; avatar: string } | null>(() => {
    try {
      const saved = localStorage.getItem('user_yt_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sync connectedProfile when profile updates
  useEffect(() => {
    const syncProfile = () => {
      try {
        const saved = localStorage.getItem('user_yt_profile');
        setConnectedProfile(saved ? JSON.parse(saved) : null);
      } catch {
        setConnectedProfile(null);
      }
    };
    window.addEventListener('yt_profile_updated', syncProfile);
    window.addEventListener('storage', syncProfile);
    return () => {
      window.removeEventListener('yt_profile_updated', syncProfile);
      window.removeEventListener('storage', syncProfile);
    };
  }, []);

  // Save YouTube API Key
  const handleSaveApiKey = (key: string) => {
    setYtApiKey(key);
    localStorage.setItem('user_yt_api_key', key);
    if (!key.trim()) {
      setIsLiveApi(false);
    }
  };

  // Connect Profile — reads from localStorage (set by GoogleSignInCard with real avatar)
  const handleConnectProfile = (channelName: string, handle: string, avatar?: string) => {
    const prof = {
      name: channelName || 'Tech & Podcast Enthusiast',
      handle: handle || '@podcast_explorer',
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(channelName || 'User')}&background=ef4444&color=fff&size=200&bold=true`,
    };
    setConnectedProfile(prof);
    localStorage.setItem('user_yt_profile', JSON.stringify(prof));
    handleSearch(channelName || 'AI, Tech & Business Podcasts');
  };

  const handleDisconnectProfile = () => {
    setConnectedProfile(null);
    localStorage.removeItem('user_yt_profile');
    window.dispatchEvent(new Event('yt_profile_updated'));
  };

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('yt_search_favorites');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('yt_search_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const [userSubscriptions, setUserSubscriptions] = useState<
    Array<{ id: string; channelId: string; title: string; description: string; thumbnail: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('yt_user_subscriptions');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return DEFAULT_SUBSCRIPTIONS;
  });

  useEffect(() => {
    localStorage.setItem('yt_user_subscriptions', JSON.stringify(userSubscriptions));
  }, [userSubscriptions]);

  const [isFetchingSubscriptions, setIsFetchingSubscriptions] = useState(false);

  // Load initial personalized videos and subscriptions on screen start if profile or key is set
  useEffect(() => {
    const fetchSubscriptionsAndFeed = async (profile: any) => {
      if (!profile || !profile.accessToken) return;
      setIsFetchingSubscriptions(true);

      try {
        // 1. Fetch user's YouTube subscriptions
        const subsRes = await fetch('/api/youtube/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: profile.accessToken }),
        });
        if (subsRes.ok) {
          const subsJson = await subsRes.json();
          if (subsJson.subscriptions && subsJson.subscriptions.length > 0) {
            setUserSubscriptions(subsJson.subscriptions);
          }
        }

        // 2. Fetch user's YouTube activity / subscription feed
        const feedRes = await fetch('/api/youtube/my-feed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: profile.accessToken }),
        });
        if (feedRes.ok) {
          const feedJson = await feedRes.json();
          if (feedJson.results && feedJson.results.length > 0) {
            setResults(feedJson.results);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch YouTube subscriptions or feed:', err);
      } finally {
        setIsFetchingSubscriptions(false);
      }
    };

    const checkAndLoad = () => {
      const savedApiKey = localStorage.getItem('user_yt_api_key');
      const savedProfile = localStorage.getItem('user_yt_profile');
      let parsedProf: any = null;
      if (savedProfile) {
        try {
          parsedProf = JSON.parse(savedProfile);
          setConnectedProfile(parsedProf);
        } catch (e) {}
      } else {
        setConnectedProfile(null);
      }

      if (parsedProf?.accessToken) {
        fetchSubscriptionsAndFeed(parsedProf);
      } else {
        handleSearch('AI, Tech & Business Podcasts');
      }
    };

    checkAndLoad();

    const handleProfileUpdate = () => {
      checkAndLoad();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const prof = event.data.profile || {
          name: 'YouTube Account Member',
          handle: '@youtube_user',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        };
        setConnectedProfile(prof);
        localStorage.setItem('user_yt_profile', JSON.stringify(prof));
        if (prof.accessToken) {
          fetchSubscriptionsAndFeed(prof);
        } else {
          handleSearch('AI, Tech & Business Podcasts');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', checkAndLoad);
    window.addEventListener('yt_profile_updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', checkAndLoad);
      window.removeEventListener('yt_profile_updated', handleProfileUpdate);
    };
  }, []);

  const [results, setResults] = useState<YouTubeSearchResult[]>(DEFAULT_YOUTUBE_VIDEOS);
  const [playingVideo, setPlayingVideo] = useState<YouTubeSearchResult | null>(null);
  const [brainstormVideo, setBrainstormVideo] = useState<YouTubeSearchResult | null>(null);
  const [copiedLinkVideoId, setCopiedLinkVideoId] = useState<string | null>(null);

  const quickTopics = [
    'SaaS & B2B Monetization',
    'Andrew Huberman Discipline',
    'AI Agents & Automation',
    'Y Combinator Startup Advice',
    'Naval Ravikant Wealth',
    'Ethics & AI Safety',
  ];

  const isSubscribed = (channelTitle: string) => {
    return userSubscriptions.some((s) => s.title.toLowerCase() === channelTitle.toLowerCase());
  };

  const toggleSubscribeChannel = (channelTitle: string, thumbnail?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const exists = isSubscribed(channelTitle);
    if (exists) {
      setUserSubscriptions((prev) => prev.filter((s) => s.title.toLowerCase() !== channelTitle.toLowerCase()));
      if (selectedChannelFilter?.toLowerCase() === channelTitle.toLowerCase()) {
        setSelectedChannelFilter(null);
      }
    } else {
      const newSub = {
        id: `sub-${Date.now()}`,
        channelId: `ch-${Date.now()}`,
        title: channelTitle,
        description: `Subscribed YouTube Channel: ${channelTitle}`,
        thumbnail: thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(channelTitle)}&background=ef4444&color=fff&size=200`,
      };
      setUserSubscriptions((prev) => [...prev, newSub]);
    }
  };

  const handleAddCustomSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newChannelInput.trim();
    if (!val) return;

    const cleanHandle = val.startsWith('@') ? val : `@${val}`;
    let cleanName = val.startsWith('@') ? val.slice(1) : val;
    cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    setNewChannelInput('');
    setShowAddChannelInput(false);

    try {
      // Try the dedicated channel-by-handle endpoint first
      const chRes = await fetch(`/api/youtube/channel-by-handle?handle=${encodeURIComponent(cleanHandle)}`);
      if (chRes.ok) {
        const chData = await chRes.json();
        if (chData.success && chData.channel?.name) {
          toggleSubscribeChannel(chData.channel.name, chData.channel.avatar);
          handleSearch(chData.channel.name);
          return;
        }
      }

      // Fallback to search
      const res = await fetch('/api/search-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanName, customApiKey: ytApiKey }),
      });
      const json = await res.json();
      let realThumb = '';
      if (json.success && json.results && json.results.length > 0) {
        const match = json.results.find((v: any) => v.channel.toLowerCase().includes(cleanName.toLowerCase())) || json.results[0];
        if (match) {
          cleanName = match.channel || cleanName;
          realThumb = match.thumbnailUrl;
        }
      }
      toggleSubscribeChannel(cleanName, realThumb);
    } catch (err) {
      toggleSubscribeChannel(cleanName);
    }

    handleSearch(cleanName);
  };

  const toggleFavoriteVideo = (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [videoId]: !prev[videoId] }));

    // Also sync with existing library podcast if present
    const existing = existingPodcasts.find((p) => p.youtubeVideoId === videoId);
    if (existing && onToggleFavorite) {
      onToggleFavorite(existing.id);
    }
  };

  const handleCopyLink = (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkVideoId(videoId);
    setTimeout(() => setCopiedLinkVideoId(null), 2000);
  };

  const handleSearch = async (searchTopic?: string) => {
    const q = searchTopic !== undefined ? searchTopic : query;
    if (!q.trim() || isSearching) return;

    setIsSearching(true);
    setQuery(q);
    setSelectedChannelFilter(null); // Reset channel filter so new search results are never hidden!

    try {
      const savedProfile = localStorage.getItem('user_yt_profile');
      let token = '';
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          token = parsed.accessToken || '';
        } catch (e) {}
      }

      const response = await fetch('/api/search-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          customApiKey: ytApiKey,
          oauthToken: token,
        }),
      });

      const json = await response.json();
      if (json.success && json.results) {
        setResults(json.results);
        setIsLiveApi(!!json.isLiveApi);
      }
    } catch (err) {
      console.error('YouTube Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVideoCardClick = async (video: YouTubeSearchResult) => {
    // Check if video is already in user's podcasts library
    const existing = existingPodcasts.find(
      (p) =>
        (p.youtubeVideoId && p.youtubeVideoId === video.videoId) ||
        p.title.toLowerCase().includes(video.title.toLowerCase().slice(0, 20))
    );

    if (existing && onSelectPodcast) {
      onSelectPodcast(existing);
      return;
    }

    // Import and summarize with Gemini, then navigate to detail page
    setImportingVideoId(video.videoId);
    const sourceUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
    try {
      await onImportVideo(video.title, sourceUrl, video.channel);
    } catch (err) {
      console.error('Failed to import and open video:', err);
    } finally {
      setImportingVideoId(null);
    }
  };

  // Convert search video to PodcastItem format for EpisodeChatbot
  const makePodcastFromSearchResult = (video: YouTubeSearchResult): PodcastItem => {
    const isFav = !!favorites[video.videoId];
    return {
      id: `yt-${video.videoId}`,
      title: video.title,
      source: `https://www.youtube.com/watch?v=${video.videoId}`,
      channel: video.channel,
      thumbnailUrl: video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
      youtubeVideoId: video.videoId,
      dateAdded: video.publishedAt || new Date().toISOString().split('T')[0],
      duration: video.duration,
      status: 'Unread',
      masteryLevel: 0,
      shortSummary: video.description || `YouTube Video Episode: ${video.title}`,
      detailedSummary: [
        {
          sectionTitle: 'Executive Overview',
          content: video.description || 'Full detailed summary and transcript analysis available upon import.',
          keyPoints: [
            `Channel: ${video.channel}`,
            `Duration: ${video.duration}`,
            `Published: ${video.publishedAt || 'Recent'}`,
          ],
        },
      ],
      monetizationOpportunities: [
        {
          id: 'm1',
          title: 'Micro-SaaS & AI Tool Opportunity',
          description: `Productizing concepts discussed in "${video.title}"`,
          model: 'B2B SaaS / Consulting',
          difficulty: 'Medium',
          potentialRevenue: '$5k - $20k/mo',
          actionSteps: ['Target audience audit', 'Build 7-day MVP', 'Launch on Twitter/X & Product Hunt'],
        },
      ],
      ethicsAndDiscipline: [
        {
          id: 'e1',
          topic: 'High Performance & Integrity',
          summary: 'Balancing aggressive leverage with ethical boundaries and personal mental health.',
          disciplineTakeaway: 'Block 90-minute deep work intervals without digital distraction.',
          ethicalConsideration: 'Ensure transparent AI boundaries and authentic value delivery.',
          debatePoints: ['Automation speed vs. quality control', 'Ethics of autonomous agents'],
        },
      ],
      reflectionQuestions: [],
      keyTimestamps: [
        { timestamp: '00:00', topic: 'Episode Introduction & Thesis', summary: video.title },
        { timestamp: '12:30', topic: 'Core Strategies & Technical Frameworks', summary: video.description || 'Detailed discussion.' },
        { timestamp: '35:10', topic: 'Monetization & Future Roadmap', summary: 'Practical implementation tactics.' },
      ],
      actionableTakeaways: [video.description || 'Key learnings from ' + video.channel],
      tags: [video.channel, 'YouTube', 'Podcast'],
      userNotes: '',
      bookmarkedTimestamps: [],
      isFavorite: isFav,
    };
  };

  // Parse duration helper
  const parseDurationMinutes = (dur: string): number => {
    let mins = 0;
    const hMatch = dur.match(/(\d+)\s*h/i);
    const mMatch = dur.match(/(\d+)\s*m/i);
    if (hMatch) mins += parseInt(hMatch[1], 10) * 60;
    if (mMatch) mins += parseInt(mMatch[1], 10);
    return mins || 30;
  };

  // Filter & Sort results
  const filteredResults = results.filter((v) => {
    if (showFavoritesOnly && !favorites[v.videoId]) return false;
    if (selectedChannelFilter && !v.channel.toLowerCase().includes(selectedChannelFilter.toLowerCase())) return false;
    return true;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (sortOption === 'latest') {
      const dateA = a.publishedAt || '2026-01-01';
      const dateB = b.publishedAt || '2026-01-01';
      return dateB.localeCompare(dateA);
    }
    if (sortOption === 'duration_desc') {
      return parseDurationMinutes(b.duration) - parseDurationMinutes(a.duration);
    }
    if (sortOption === 'duration_asc') {
      return parseDurationMinutes(a.duration) - parseDurationMinutes(b.duration);
    }
    return 0; // 'relevant'
  });

  const favoritesCount = Object.values(favorites).filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Modern Compact Glance Design Header Toolbar */}
      <div className="bg-[#1d2130] border border-[#2d3245] rounded-2xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Topic Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          <button
            onClick={() => handleSearch('AI, Tech & Business Podcasts')}
            className="yt-chip yt-chip-active"
          >
            <span>All Videos</span>
          </button>
          {quickTopics.map((topic, idx) => (
            <button
              key={idx}
              disabled={isSearching}
              onClick={() => handleSearch(topic)}
              className="yt-chip"
            >
              <span>{topic}</span>
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {onCreateKnowledgeGroup && (
            <button
              onClick={() => {
                const name = prompt('Enter name for new Knowledge Group (e.g. AI Agents, SaaS Ideas):');
                if (name && name.trim()) onCreateKnowledgeGroup(name.trim());
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#5b51d8] to-[#00c6ff] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-[#5b51d8]/20 cursor-pointer shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5 text-white" />
              <span>+ Create Group</span>
            </button>
          )}

          {!connectedProfile ? (
            <button
              onClick={() => setShowApiSettings(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#222736] hover:bg-[#2a3042] border border-[#2d3245] text-[#f1f5f9] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Tv className="w-3.5 h-3.5 text-[#00c6ff]" />
              <span>Connect Channel</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-[#222736] border border-[#2d3245] pl-2 pr-3 py-1 rounded-xl">
              <img src={connectedProfile.avatar} alt="Profile" className="w-5 h-5 rounded-full object-cover border border-[#00c6ff] shrink-0" />
              <span className="text-xs font-semibold text-white truncate">{connectedProfile.name}</span>
              <button
                onClick={handleDisconnectProfile}
                title="Disconnect"
                className="text-[#94a3b8] hover:text-red-400 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* API Key & YouTube Profile Modal */}
      {showApiSettings && (
        <GoogleSignInCard
          isModal={true}
          onClose={() => setShowApiSettings(false)}
          onSuccess={(prof) => {
            const fullProf = {
              name: prof.name,
              handle: prof.handle,
              avatar: prof.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(prof.name)}&background=3ea6ff&color=000&size=200&bold=true`,
            };
            setConnectedProfile(fullProf);
            setShowApiSettings(false);
            // Search for the connected channel's content
            handleSearch(prof.name || 'AI, Tech & Business Podcasts');
          }}
        />
      )}

      {/* Subscribed YouTube Channels Carousel Bar */}
      <div className="bg-[#181818] border border-[#272727] rounded-3xl p-4 sm:p-5 space-y-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-300">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[#3ea6ff] font-bold text-xs sm:text-sm">
              <Tv className="w-4 h-4 text-[#3ea6ff] fill-[#3ea6ff]" />
              Subscribed Channels ({userSubscriptions.length})
            </span>
            {selectedChannelFilter && (
              <button
                onClick={() => setSelectedChannelFilter(null)}
                className="px-2 py-0.5 rounded-lg bg-[#3ea6ff]/20 text-[#3ea6ff] border border-[#3ea6ff]/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>Filter: {selectedChannelFilter}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddChannelInput(!showAddChannelInput)}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1 rounded-xl border border-indigo-500/30 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>+ Add YouTube Channel</span>
            </button>
            <button
              onClick={() => {
                if (userSubscriptions.length > 0) {
                  setUserSubscriptions([]);
                  setSelectedChannelFilter(null);
                } else {
                  setUserSubscriptions(DEFAULT_SUBSCRIPTIONS);
                }
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title={userSubscriptions.length > 0 ? "Clear sample channel list to build your custom subscriptions" : "Restore default sample podcast channels"}
            >
              {userSubscriptions.length > 0 ? 'Clear List' : 'Restore Sample Defaults'}
            </button>
          </div>
        </div>

        {showAddChannelInput && (
          <form onSubmit={handleAddCustomSubscription} className="flex gap-2 animate-in fade-in duration-200">
            <input
              type="text"
              value={newChannelInput}
              onChange={(e) => setNewChannelInput(e.target.value)}
              placeholder="Enter YouTube channel name or handle (e.g. @mkbhd, Fireship, Lex Fridman)"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
            >
              + Add Channel
            </button>
          </form>
        )}

        {/* Carousel of Subscribed Channel Badges with Left/Right Scroll Arrows */}
        <div className="relative flex items-center group/subs">
          {/* Scroll Left Button */}
          <button
            onClick={scrollSubsLeft}
            className="absolute -left-2 z-10 p-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 shadow-lg backdrop-blur-md cursor-pointer transition-all hover:scale-110"
            title="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Horizontally Scrollable Container */}
          <div
            ref={subsContainerRef}
            className="flex items-center gap-3 overflow-x-auto py-1 px-5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent scroll-smooth w-full select-none"
          >
            <button
              onClick={() => setSelectedChannelFilter(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all shrink-0 cursor-pointer text-xs font-semibold ${
                selectedChannelFilter === null
                  ? 'bg-red-600 text-white border-red-500 shadow-md'
                  : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>All Subscriptions ({userSubscriptions.length})</span>
            </button>

            {userSubscriptions.length === 0 ? (
              <span className="text-xs text-slate-400 italic py-2">
                No channels subscribed yet. Click &quot;+ Add YouTube Channel&quot; above to add your favorite creators!
              </span>
            ) : (
              userSubscriptions.map((sub) => {
                const isSelected = selectedChannelFilter === sub.title;
                return (
                  <div
                    key={sub.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all shrink-0 text-left ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-500 shadow-md font-bold'
                        : 'bg-slate-950/80 hover:bg-slate-800/80 text-slate-200 border-slate-800 hover:border-red-500/40'
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (isSelected) {
                          setSelectedChannelFilter(null);
                        } else {
                          setSelectedChannelFilter(sub.title);
                          handleSearch(sub.title);
                        }
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      {sub.thumbnail ? (
                        <img src={sub.thumbnail} alt={sub.title} className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-700" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-[9px] shrink-0">
                          {sub.title.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-semibold truncate max-w-[120px] leading-tight">{sub.title}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSubscribeChannel(sub.title);
                      }}
                      className="text-slate-400 hover:text-red-300 transition-colors p-0.5 rounded-full hover:bg-red-500/20 cursor-pointer"
                      title={`Remove ${sub.title}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={scrollSubsRight}
            className="absolute -right-2 z-10 p-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 shadow-lg backdrop-blur-md cursor-pointer transition-all hover:scale-110"
            title="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 rounded-3xl flex flex-col sm:flex-row items-center gap-3 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search YouTube podcasts, hosts, or business topics..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-8 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-normal"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => handleSearch()}
          disabled={!query.trim() || isSearching}
          className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
        >
          {isSearching ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>Search YouTube</span>
            </>
          )}
        </button>
      </div>

      {/* Controls Bar: Sort, Favorites Filter, Grid/List Mode */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/90 dark:bg-slate-950/80 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">{sortedResults.length} Videos</span>
            {query && <span className="text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[120px]">&quot;{query}&quot;</span>}
          </div>

          {/* Favorites Filter Chip */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border shrink-0 ${
              showFavoritesOnly
                ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white text-white' : 'text-rose-500'}`} />
            <span>Favorites ({favoritesCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-between sm:justify-end overflow-x-auto scrollbar-none pb-0.5">
          {/* Sorting Options Bar - Horizontally Scrollable on Mobile */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-xs shrink-0">
            <button
              onClick={() => setSortOption('latest')}
              className={`px-2.5 py-1 rounded-lg transition-all text-xs cursor-pointer shrink-0 ${
                sortOption === 'latest' ? 'bg-red-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ⚡ Latest
            </button>
            <button
              onClick={() => setSortOption('relevant')}
              className={`px-2.5 py-1 rounded-lg transition-all text-xs cursor-pointer shrink-0 ${
                sortOption === 'relevant' ? 'bg-red-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🔥 Relevant
            </button>
            <button
              onClick={() => setSortOption('duration_desc')}
              className={`px-2.5 py-1 rounded-lg transition-all text-xs cursor-pointer shrink-0 ${
                sortOption === 'duration_desc' ? 'bg-red-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ⏱️ Longest
            </button>
            <button
              onClick={() => setSortOption('duration_asc')}
              className={`px-2.5 py-1 rounded-lg transition-all text-xs cursor-pointer shrink-0 ${
                sortOption === 'duration_asc' ? 'bg-red-600 text-white font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ⌛ Shortest
            </button>
          </div>

          {/* Grid / List Layout Switcher */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-xs shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              title="Compact Grid View"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Horizontal List View"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Player Quick Preview Bar */}
      {playingVideo && (
        <div className="space-y-3 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-red-200 dark:border-red-500/30 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-red-500" />
              Quick In-App Preview: {playingVideo.title}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVideoCardClick(playingVideo)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open Full Analysis Page</span>
              </button>
              <button
                onClick={() => setPlayingVideo(null)}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
          <div className="max-w-4xl mx-auto">
            <EmbeddedYouTubePlayer
              sourceUrlOrId={playingVideo.videoId}
              title={playingVideo.title}
              channel={playingVideo.channel}
            />
          </div>
        </div>
      )}

      {/* Video Cards Section (YouTube 4-Column Responsive Grid) */}
      {sortedResults.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
          {sortedResults.map((video) => {
            const isFav = !!favorites[video.videoId];
            const existing = existingPodcasts.find(
              (p) =>
                (p.youtubeVideoId && p.youtubeVideoId === video.videoId) ||
                p.title.toLowerCase().includes(video.title.toLowerCase().slice(0, 20))
            );
            const isThisImporting = importingVideoId === video.videoId;

            return (
              <YouTubeVideoCard
                key={video.videoId}
                video={{
                  videoId: video.videoId,
                  title: video.title,
                  channel: video.channel,
                  thumbnailUrl: video.thumbnailUrl,
                  duration: video.duration,
                  publishedAt: video.publishedAt,
                  description: video.description,
                  isFavorite: isFav,
                  isImported: !!existing,
                }}
                groups={knowledgeGroups}
                onAddToGroup={onAddVideoToGroup}
                onCreateGroup={onCreateKnowledgeGroup}
                onPlay={(v) => setPlayingVideo(video)}
                onBrainstorm={(v) => setBrainstormVideo(video)}
                onSummarize={(v) => handleVideoCardClick(video)}
                onToggleFavorite={(id, e) => toggleFavoriteVideo(video.videoId, e)}
                onSubscribeChannel={(ch, e) => toggleSubscribeChannel(video.channel, video.thumbnailUrl, e)}
                isSubscribed={isSubscribed(video.channel)}
                isImporting={isThisImporting}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3 shadow-xs">
          <Heart className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300">No favorite YouTube videos saved yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click the ❤️ heart icon on any YouTube video card above to add it to your favorites list!
          </p>
        </div>
      )}

      {/* AI Brainstorming Chatbot Drawer / Modal */}
      {brainstormVideo && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wide">
                    <span>AI Brainstorm Assistant</span>
                    <span className="text-slate-400 dark:text-slate-600">•</span>
                    <span>{brainstormVideo.channel}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    {brainstormVideo.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleVideoCardClick(brainstormVideo)}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-2xl shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Full Analysis View</span>
                </button>
                <button
                  onClick={() => setBrainstormVideo(null)}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-2xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chatbot Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50/50 dark:bg-slate-900/90">
              <EpisodeChatbot podcast={makePodcastFromSearchResult(brainstormVideo)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
