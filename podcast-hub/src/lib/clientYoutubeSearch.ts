/**
 * Client-Side YouTube & AI Search Resolver for Static Hosting (GitHub Pages / Vercel Static)
 * Provides direct browser fetching from Google's YouTube Data API v3 and fallback library.
 */

export interface ClientSearchResult {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  thumbnailUrl: string;
  description: string;
  publishedAt: string;
}

export interface ClientPlaylist {
  id: string;
  name: string;
  title: string;
  channel: string;
  itemCount: number;
  thumbnail: string;
  thumbnailUrl: string;
  description: string;
}

export const DEFAULT_YOUTUBE_RECORDS: ClientSearchResult[] = [
  {
    videoId: 'M576WGiDBdQ',
    title: 'Jeff Bezos on Amazon, Blue Origin, AI & Future of Technology',
    channel: 'Lex Fridman Podcast',
    duration: '3h 52m',
    thumbnailUrl: 'https://img.youtube.com/vi/M576WGiDBdQ/hqdefault.jpg',
    description: 'Jeff Bezos shares rare insights on leadership principles, decision-making frameworks, space exploration, and building scalable engineering cultures.',
    publishedAt: '2026-02-10',
  },
  {
    videoId: 'gX_m3fU3e18',
    title: 'Dr. Andrew Huberman: Protocols for Peak Focus, Discipline & Energy',
    channel: 'Huberman Lab',
    duration: '1h 52m',
    thumbnailUrl: 'https://img.youtube.com/vi/gX_m3fU3e18/hqdefault.jpg',
    description: 'Neurobiological toolkits for deep focus, managing dopamine baselines, optimizing circadian rhythms, and maintaining mental endurance.',
    publishedAt: '2026-02-08',
  },
  {
    videoId: '8S0FDjFBj8o',
    title: 'How to Build, Monetize & Scale SaaS Startups in 2026',
    channel: 'Y Combinator',
    duration: '48m 12s',
    thumbnailUrl: 'https://img.youtube.com/vi/8S0FDjFBj8o/hqdefault.jpg',
    description: 'A practical guide from Y Combinator partners on finding product-market fit, pricing software, and acquiring B2B customers fast.',
    publishedAt: '2026-02-02',
  },
  {
    videoId: 'b02TIsInTmg',
    title: 'Sam Altman on OpenAI, GPT-5, AI Agents & Future Wealth',
    channel: 'Lex Fridman Podcast',
    duration: '2h 15m',
    thumbnailUrl: 'https://img.youtube.com/vi/b02TIsInTmg/hqdefault.jpg',
    description: 'Sam Altman discusses the trajectory of autonomous AI agents, economic transformation, labor automation, and compute scaling.',
    publishedAt: '2026-01-28',
  },
  {
    videoId: '3qHkcs3kG44',
    title: 'Andrew Carnegie: Ruthless Efficiency & Industrial Mastery',
    channel: 'Founders Podcast',
    duration: '58m',
    thumbnailUrl: 'https://img.youtube.com/vi/3qHkcs3kG44/hqdefault.jpg',
    description: 'Deconstructing Andrew Carnegie’s unit cost accounting principles, relentless operational focus, and executive partnership culture.',
    publishedAt: '2026-01-15',
  },
  {
    videoId: 'L_LUpnjgPso',
    title: 'AI Agents, B2B Monetization & Micro-SaaS Ecosystems',
    channel: 'Lenny’s Podcast',
    duration: '1h 12m',
    thumbnailUrl: 'https://img.youtube.com/vi/L_LUpnjgPso/hqdefault.jpg',
    description: 'Lenny interviews top product leaders on outcome-based pricing models for autonomous AI agents and low-churn micro-SaaS wrappers.',
    publishedAt: '2026-01-10',
  },
];

/**
 * Direct client-side fetch of user's YouTube Playlists using Google OAuth access token
 */
export async function fetchClientPlaylists(accessToken?: string): Promise<ClientPlaylist[]> {
  if (!accessToken) return [];

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=20`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        return data.items.map((item: any) => {
          const snip = item.snippet || {};
          const details = item.contentDetails || {};
          return {
            id: item.id,
            name: snip.title || 'YouTube Playlist',
            title: snip.title || 'YouTube Playlist',
            channel: snip.channelTitle || 'YouTube Channel',
            itemCount: details.itemCount || 0,
            thumbnail: snip.thumbnails?.high?.url || snip.thumbnails?.medium?.url || `https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?auto=format&fit=crop&w=400`,
            thumbnailUrl: snip.thumbnails?.high?.url || snip.thumbnails?.medium?.url || `https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?auto=format&fit=crop&w=400`,
            description: snip.description || '',
          };
        });
      }
    }
  } catch (err) {
    console.warn('[Client YouTube] Playlists fetch error:', err);
  }
  return [];
}

/**
 * Direct client-side fetch of user's Liked Videos using Google OAuth access token
 */
export async function fetchClientLikedVideos(accessToken?: string): Promise<ClientSearchResult[]> {
  if (!accessToken) return [];

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=15`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        return data.items.map((item: any) => {
          const snip = item.snippet || {};
          return {
            videoId: item.id,
            title: snip.title || 'Liked Video',
            channel: snip.channelTitle || 'YouTube Channel',
            duration: '25m',
            thumbnailUrl: snip.thumbnails?.high?.url || snip.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
            description: snip.description || '',
            publishedAt: (snip.publishedAt || '').split('T')[0] || 'Recent',
          };
        });
      }
    }
  } catch (err) {
    console.warn('[Client YouTube] Liked videos fetch error:', err);
  }
  return [];
}

/**
 * Execute client-side YouTube search with public oEmbed / fetch fallback
 */
export async function executeClientSearch(query: string, apiKey?: string): Promise<ClientSearchResult[]> {
  const cleanQuery = (query || '').trim().toLowerCase();

  // 1. Direct YouTube Video URL or ID check
  const videoUrlMatch = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|\/v\/|\/embed\/|^)([a-zA-Z0-9_-]{11})(?:[&?\s]|$)/i);
  if (videoUrlMatch && videoUrlMatch[1] && videoUrlMatch[1].length === 11) {
    const vId = videoUrlMatch[1];
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`);
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        return [{
          videoId: vId,
          title: oembed.title || 'YouTube Video',
          channel: oembed.author_name || 'YouTube Creator',
          duration: '35m',
          thumbnailUrl: oembed.thumbnail_url || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
          description: `Direct video episode import from ${oembed.author_name || 'YouTube'}. Watch and synthesize executive insights.`,
          publishedAt: new Date().toISOString().split('T')[0],
        }];
      }
    } catch {}
  }

  // 2. If user provided a custom YouTube API key, call official endpoint client-side
  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=date&maxResults=12&key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          return data.items.map((item: any) => {
            const vId = item.id?.videoId;
            const snip = item.snippet || {};
            return {
              videoId: vId,
              title: snip.title || 'YouTube Episode',
              channel: snip.channelTitle || 'YouTube Creator',
              duration: '30m',
              thumbnailUrl: snip.thumbnails?.high?.url || snip.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
              description: snip.description || `Watch episode by ${snip.channelTitle || 'creator'} on YouTube.`,
              publishedAt: (snip.publishedAt || '').split('T')[0] || 'Recent',
            };
          });
        }
      }
    } catch {}
  }

  // 3. Fallback client-side filter over default curated video library
  const matched = DEFAULT_YOUTUBE_RECORDS.filter(
    (v) =>
      v.title.toLowerCase().includes(cleanQuery) ||
      v.channel.toLowerCase().includes(cleanQuery) ||
      v.description.toLowerCase().includes(cleanQuery)
  );

  return matched.length > 0 ? matched : DEFAULT_YOUTUBE_RECORDS;
}
