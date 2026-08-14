import React, { useState, useEffect } from 'react';
import { PodcastItem, YouTubeSearchResult, KnowledgeGroup } from '../types';
import { EmbeddedYouTubePlayer } from './EmbeddedYouTubePlayer';
import { VideoThumbnail } from './VideoThumbnail';
import { EpisodeChatbot } from './EpisodeChatbot';
import { GoogleSignInCard } from './GoogleSignInCard';
import { YouTubeVideoCard } from './YouTubeVideoCard';
import { executeClientSearch } from '../lib/clientYoutubeSearch';
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
    thumbnail: 'https://unavatar.io/youtube/lexfridman',
  },
  {
    id: 'sub-2',
    channelId: 'UC2D2CMWXMOVWx7giW1n3LIg',
    title: 'Huberman Lab',
    description: 'Neuroscience, Focus & High Performance Protocols',
    thumbnail: 'https://unavatar.io/youtube/hubermanlab',
  },
  {
    id: 'sub-3',
    channelId: 'UCvjjWvA-C0g9F-dC_uXzK7w',
    title: 'Y Combinator',
    description: 'SaaS, Startups, Monetization & Founders',
    thumbnail: 'https://unavatar.io/youtube/ycombinator',
  },
  {
    id: 'sub-4',
    channelId: 'UC1T2j6g9nK8kZ8K9sR1jK0w',
    title: 'Naval Ravikant',
    description: 'Wealth, Leverage, Specific Knowledge & Mindset',
    thumbnail: 'https://unavatar.io/youtube/naval',
  },
  {
    id: 'sub-5',
    channelId: 'UCBv_0q-JZuJ2u5YQk055g8w',
    title: 'All-In Podcast',
    description: 'Tech, Venture Capital, Macro Economy & Business',
    thumbnail: 'https://unavatar.io/youtube/allin',
  },
  {
    id: 'sub-6',
    channelId: 'UCg3u1D-s5g0n3tZ5f04j29w',
    title: 'The Diary Of A CEO',
    description: 'Entrepreneurship, Personal Branding & Media',
    thumbnail: 'https://unavatar.io/youtube/thediaryofaceo',
  },
  {
    id: 'sub-7',
    channelId: 'UC4tQ2z1n5s04g03nJ05k61w',
    title: 'My First Million',
    description: 'Micro-SaaS Product Ideas & Business Growth',
    thumbnail: 'https://unavatar.io/youtube/myfirstmillionpod',
  },
  {
    id: 'sub-8',
    channelId: 'UC5q0z55-dC04j02k501j62w',
    title: 'Tim Ferriss',
    description: 'Deconstructing Peak Performance & Tactics',
    thumbnail: 'https://unavatar.io/youtube/timferriss',
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

  // Helper to map saved library podcasts to YouTube search card items
  const mapPodcastsToResults = (list: PodcastItem[]): YouTubeSearchResult[] => {
    return (list || []).map((p) => ({
      videoId: p.youtubeVideoId || p.id.replace('yt-', ''),
      title: p.title,
      channel: p.channel,
      duration: p.duration,
      thumbnailUrl: p.thumbnailUrl || `https://img.youtube.com/vi/${p.youtubeVideoId || p.id.replace('yt-', '')}/hqdefault.jpg`,
      description: p.shortSummary || `Episode from ${p.channel}`,
      publishedAt: p.dateAdded || 'Recently',
      isFavorite: p.isFavorite,
      channelAvatar: p.channelAvatar,
    }));
  };

  const [results, setResults] = useState<YouTubeSearchResult[]>(() => {
    if (existingPodcasts && existingPodcasts.length > 0) {
      return mapPodcastsToResults(existingPodcasts);
    }
    return [];
  });
  const [playingVideo, setPlayingVideo] = useState<YouTubeSearchResult | null>(null);
  const [brainstormVideo, setBrainstormVideo] = useState<YouTubeSearchResult | null>(null);
  const [copiedLinkVideoId, setCopiedLinkVideoId] = useState<string | null>(null);

  // Load initial personalized videos and subscriptions on screen start if profile or key is set
  useEffect(() => {
    const fetchSubscriptionsAndFeed = async (profile: any) => {
      if (!profile || !profile.accessToken) return;
      setIsFetchingSubscriptions(true);

      const isStaticHost = window.location.origin.includes('github.io') || window.location.origin.includes('vercel.app');

      try {
        if (!isStaticHost) {
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
        } else {
          // Direct client-side fetch from Google's YouTube Data API for static host
          try {
            const subRes = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=20`, {
              headers: { Authorization: `Bearer ${profile.accessToken}` }
            });
            if (subRes.ok) {
              const subData = await subRes.json();
              if (subData.items && subData.items.length > 0) {
                const mappedSubs = subData.items.map((it: any) => ({
                  title: it.snippet?.title || 'Channel',
                  channelId: it.snippet?.resourceId?.channelId || '',
                  thumbnail: it.snippet?.thumbnails?.default?.url || '',
                }));
                setUserSubscriptions(mappedSubs);
              }
            }
          } catch {}
        }
      } catch (err) {
        console.info('Static hosting detected — using client YouTube Data API.');
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
      } else if (existingPodcasts && existingPodcasts.length > 0) {
        setResults(mapPodcastsToResults(existingPodcasts));
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
  }, [existingPodcasts]);

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
    const isStaticHost = window.location.origin.includes('github.io') || window.location.origin.includes('vercel.app');

    try {
      if (!isStaticHost) {
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
      }
    } catch {}

    // Fallback to search
    try {
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

      const isStaticHost = window.location.origin.includes('github.io') || window.location.origin.includes('vercel.app');

      if (!isStaticHost) {
        try {
          const response = await fetch('/api/search-youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: q,
              customApiKey: ytApiKey,
              oauthToken: token,
            }),
          });

          if (response.ok) {
            const json = await response.json();
            if (json.success && json.results) {
              setResults(json.results);
              setIsLiveApi(!!json.isLiveApi);
              return;
            }
          }
        } catch (e) {
          console.warn('Backend search API unavailable, using client search fallback');
        }
      }

      // Client-side fallback for static hosting (GitHub Pages / Vercel Static)
      const clientResults = await executeClientSearch(q, ytApiKey);
      setResults(clientResults);
      setIsLiveApi(false);
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

  // Parse relative time strings like "2 hours ago", "3 days ago", "1 month ago", "2026-02-10" into numeric value for sorting
  const parseRelativeTimeToScore = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const str = timeStr.toLowerCase().trim();
    if (str.includes('minute') || str.includes('min')) {
      const match = str.match(/(\d+)/);
      return (match ? parseInt(match[1], 10) : 1);
    }
    if (str.includes('hour') || str.includes('hr')) {
      const match = str.match(/(\d+)/);
      return (match ? parseInt(match[1], 10) : 1) * 60;
    }
    if (str.includes('day')) {
      const match = str.match(/(\d+)/);
      return (match ? parseInt(match[1], 10) : 1) * 1440;
    }
    if (str.includes('week')) {
      const match = str.match(/(\d+)/);
      return (match ? parseInt(match[1], 10) : 1) * 10080;
    }
    if (str.includes('month')) {
      const match = str.match(/(\d+)/);
      return (match ? parseInt(match[1], 10) : 1) * 43200;
    }
    if (str.includes('year')) {
      const match = str.match(/(\d+)/);
      return (match ? parseInt(match[1], 10) : 1) * 525600;
    }
    // Attempt ISO date parse
    const timestamp = Date.parse(timeStr);
    if (!isNaN(timestamp)) {
      return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    }
    return 999999;
  };

  // Robust duration parser for HH:MM:SS, MM:SS, "1h 30m", "45m"
  const parseDurationMinutes = (dur?: string): number => {
    if (!dur) return 30;
    const str = dur.trim();
    
    // Check HH:MM:SS or MM:SS format
    const colonParts = str.split(':');
    if (colonParts.length === 3) {
      const h = parseInt(colonParts[0], 10) || 0;
      const m = parseInt(colonParts[1], 10) || 0;
      return h * 60 + m;
    }
    if (colonParts.length === 2) {
      const m = parseInt(colonParts[0], 10) || 0;
      return m;
    }

    let mins = 0;
    const hMatch = str.match(/(\d+)\s*h/i);
    const mMatch = str.match(/(\d+)\s*m/i);
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
      const scoreA = parseRelativeTimeToScore(a.publishedAt);
      const scoreB = parseRelativeTimeToScore(b.publishedAt);
      return scoreA - scoreB; // Lower score = more recent (e.g. 2 hours ago < 3 days ago)
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
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Topic Chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
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
        <div className="flex items-center gap-2 shrink-0">
          {onCreateKnowledgeGroup && (
            <button
              onClick={() => {
                const name = prompt('Enter name for new Knowledge Group (e.g. AI Agents, SaaS Ideas):');
                if (name && name.trim()) onCreateKnowledgeGroup(name.trim());
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all cursor-pointer shadow-2xs"
              style={{ background: '#11A888' }}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ Create Group</span>
            </button>
          )}

          {!connectedProfile ? (
            <button
              onClick={() => setShowApiSettings(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition-all cursor-pointer shrink-0"
            >
              <Tv className="w-3.5 h-3.5 text-slate-500" />
              <span>Connect Channel</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 pl-2 pr-3 py-1 rounded-lg">
              <img src={connectedProfile.avatar} alt="Profile" className="w-5 h-5 rounded-full object-cover shrink-0" />
              <span className="text-xs font-medium text-slate-800 truncate max-w-[120px]">{connectedProfile.name}</span>
              <button
                onClick={handleDisconnectProfile}
                title="Disconnect"
                className="text-slate-400 hover:text-red-500 p-0.5"
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

      {/* Subscribed YouTube Channels Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-slate-700 font-medium text-xs">
              <Tv className="w-3.5 h-3.5 text-teal-600" />
              Subscribed Channels ({userSubscriptions.length})
            </span>
            {selectedChannelFilter && (
              <button
                onClick={() => setSelectedChannelFilter(null)}
                className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Filter: {selectedChannelFilter}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddChannelInput(!showAddChannelInput)}
              className="text-[11px] font-medium text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-md border border-teal-200 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>+ Add Channel</span>
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
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 px-2 py-1 transition-all cursor-pointer"
            >
              {userSubscriptions.length > 0 ? 'Clear List' : 'Restore Defaults'}
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
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-400"
            />
            <button
              type="submit"
              className="bg-[#11A888] hover:bg-[#0e9478] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0"
            >
              + Add
            </button>
          </form>
        )}

        {/* Carousel of Subscribed Channel Badges */}
        <div className="relative flex items-center group/subs">
          <button
            onClick={scrollSubsLeft}
            className="absolute -left-2 z-10 p-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer transition-all"
            title="Scroll Left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div
            ref={subsContainerRef}
            className="flex items-center gap-2 overflow-x-auto py-1 px-4 scrollbar-none scroll-smooth w-full select-none"
          >
            <button
              onClick={() => setSelectedChannelFilter(null)}
              className={`px-3 py-1 rounded-lg border transition-all shrink-0 cursor-pointer text-xs font-medium ${
                selectedChannelFilter === null
                  ? 'bg-[#11A888] text-white border-transparent shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>All ({userSubscriptions.length})</span>
            </button>

            {userSubscriptions.length === 0 ? (
              <span className="text-xs text-slate-400 italic py-1">
                No channels subscribed yet. Click &quot;+ Add Channel&quot; to add creators.
              </span>
            ) : (
              userSubscriptions.map((sub) => {
                const isSelected = selectedChannelFilter === sub.title;
                return (
                  <div
                    key={sub.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all shrink-0 text-left ${
                      isSelected
                        ? 'bg-[#11A888] text-white border-transparent shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
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
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      {sub.thumbnail ? (
                        <img
                          src={sub.thumbnail}
                          alt={sub.title}
                          className="w-4 h-4 rounded-full object-cover shrink-0 border border-slate-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.title)}&background=cc0000&color=fff&size=128&bold=true`;
                          }}
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-teal-600 text-white font-medium flex items-center justify-center text-[8px] shrink-0">
                          {sub.title.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-medium truncate max-w-[110px] leading-tight">{sub.title}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSubscribeChannel(sub.title);
                      }}
                      className={`transition-colors p-0.5 rounded ${isSelected ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}
                      title={`Remove ${sub.title}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={scrollSubsRight}
            className="absolute -right-2 z-10 p-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm cursor-pointer transition-all"
            title="Scroll Right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white border border-slate-200 p-3 sm:p-3.5 rounded-xl flex flex-col sm:flex-row items-center gap-3 shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search YouTube podcasts, hosts, or business topics..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-8 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-400 font-normal"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => handleSearch()}
          disabled={!query.trim() || isSearching}
          className="w-full sm:w-auto text-white px-4 py-2 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
          style={{ background: '#11A888' }}
        >
          {isSearching ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Searching...</span>
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              <span>Search YouTube</span>
            </>
          )}
        </button>
      </div>

      {/* Controls Bar: Sort, Favorites Filter, Grid/List Mode */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">{sortedResults.length} Videos</span>
            {query && <span className="text-teal-600 font-medium truncate max-w-[120px]">&quot;{query}&quot;</span>}
          </div>

          {/* Favorites Filter Chip */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border shrink-0 ${
              showFavoritesOnly
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:text-slate-900'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-white text-white' : 'text-rose-500'}`} />
            <span>Favorites ({favoritesCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-between sm:justify-end overflow-x-auto scrollbar-none">
          {/* Sorting Options */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setSortOption('latest')}
              className={`px-2.5 py-1 rounded-md transition-all text-xs cursor-pointer shrink-0 ${
                sortOption === 'latest' ? 'bg-[#11A888] text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Latest
            </button>
            <button
              onClick={() => setSortOption('relevant')}
              className={`px-2.5 py-1 rounded-md transition-all text-xs cursor-pointer shrink-0 ${
                sortOption === 'relevant' ? 'bg-[#11A888] text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Relevant
            </button>
            <button
              onClick={() => setSortOption('duration_desc')}
              className={`px-2.5 py-1 rounded-md transition-all text-xs cursor-pointer shrink-0 ${
                sortOption === 'duration_desc' ? 'bg-[#11A888] text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Longest
            </button>
            <button
              onClick={() => setSortOption('duration_asc')}
              className={`px-2.5 py-1 rounded-md transition-all text-xs cursor-pointer shrink-0 ${
                sortOption === 'duration_asc' ? 'bg-[#11A888] text-white font-medium' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shortest
            </button>
          </div>

          {/* Grid / List Layout Switcher */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#11A888] text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-[#11A888] text-white' : 'text-slate-500 hover:text-slate-900'
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
                  channelAvatar: video.channelAvatar || video.avatarUrl,
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
