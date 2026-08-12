/**
 * Utility functions for YouTube video handling, timestamp parsing, and thumbnail formatting.
 */

export function extractYouTubeVideoId(urlOrSource?: string): string | null {
  if (!urlOrSource) return null;
  
  // Clean up input
  const str = urlOrSource.trim();
  
  // Standard 11-char ID check
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }

  // Regex match for various YouTube URL patterns
  const match = str.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  );

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export function timestampToSeconds(timestamp: string): number {
  if (!timestamp) return 0;
  
  // Remove non-digit and non-colon chars
  const clean = timestamp.trim().replace(/[^0-9:]/g, '');
  const parts = clean.split(':').map(Number);
  
  if (parts.length === 3) {
    // hh:mm:ss
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // mm:ss
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    return parts[0];
  }
  
  return 0;
}

export function secondsToTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const mStr = String(m).padStart(2, '0');
  const sStr = String(s).padStart(2, '0');

  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
  return `${m}:${sStr}`;
}

export function getYouTubeThumbnailUrl(videoId?: string): string {
  if (!videoId) {
    return 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80';
  }
  const cleanId = extractYouTubeVideoId(videoId) || videoId;
  return `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
}

export function getFallbackThumbnail(seed?: string, title?: string): string {
  const text = `${seed || ''} ${title || ''}`.toLowerCase();

  if (
    text.includes('saas') ||
    text.includes('code') ||
    text.includes('dev') ||
    text.includes('software') ||
    text.includes('startup') ||
    text.includes('y combinator') ||
    text.includes('yc')
  ) {
    return 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80';
  }
  if (
    text.includes('huberman') ||
    text.includes('focus') ||
    text.includes('brain') ||
    text.includes('health') ||
    text.includes('mind') ||
    text.includes('dopamine') ||
    text.includes('discipline')
  ) {
    return 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80';
  }
  if (
    text.includes('ai') ||
    text.includes('agent') ||
    text.includes('automation') ||
    text.includes('robot') ||
    text.includes('future') ||
    text.includes('tech')
  ) {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
  }
  if (
    text.includes('naval') ||
    text.includes('wealth') ||
    text.includes('money') ||
    text.includes('invest') ||
    text.includes('finance') ||
    text.includes('altman')
  ) {
    return 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80';
  }
  if (
    text.includes('founder') ||
    text.includes('carnegie') ||
    text.includes('ceo') ||
    text.includes('history') ||
    text.includes('leader')
  ) {
    return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80';
  }
  if (
    text.includes('microphone') ||
    text.includes('interview') ||
    text.includes('podcast') ||
    text.includes('audio') ||
    text.includes('speech')
  ) {
    return 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80';
  }

  const fallbacks = [
    'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1589903308904-1010c2294adc?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
  ];
  if (!seed) return fallbacks[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
  }
  return fallbacks[Math.abs(hash) % fallbacks.length];
}
