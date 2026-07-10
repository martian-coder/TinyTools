export interface LinkPreview {
  type: 'youtube' | 'instagram';
  id: string;
  url: string;
}

export function extractLinks(text: string): LinkPreview[] {
  const links: LinkPreview[] = [];

  // YouTube patterns
  const youtubePatterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
  ];

  youtubePatterns.forEach(pattern => {
    const matches = text.matchAll(new RegExp(pattern, 'g'));
    for (const match of matches) {
      links.push({
        type: 'youtube',
        id: match[1],
        url: `https://www.youtube.com/watch?v=${match[1]}`,
      });
    }
  });

  // Instagram patterns
  const instagramPatterns = [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
  ];

  instagramPatterns.forEach(pattern => {
    const matches = text.matchAll(new RegExp(pattern, 'g'));
    for (const match of matches) {
      const id = match[1];
      links.push({
        type: 'instagram',
        id,
        url: `https://www.instagram.com/p/${id}/`,
      });
    }
  });

  return links;
}
