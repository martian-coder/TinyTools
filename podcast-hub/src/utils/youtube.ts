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
    return 'https://img.youtube.com/vi/M576WGiDBdQ/hqdefault.jpg';
  }
  const cleanId = extractYouTubeVideoId(videoId) || videoId;
  return `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
}

export function getFallbackThumbnail(seed?: string, title?: string): string {
  const cleanId = extractYouTubeVideoId(seed || '') || extractYouTubeVideoId(title || '');
  if (cleanId) {
    return `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
  }
  return 'https://img.youtube.com/vi/M576WGiDBdQ/hqdefault.jpg';
}
