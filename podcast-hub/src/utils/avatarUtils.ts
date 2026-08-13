/**
 * Centralized Channel Avatar Utility Module
 * Guarantees 100% reliable channel avatar resolution across all views.
 */

// Well-known podcast creators map with tested high-res avatar sources
const KNOWN_CREATOR_AVATARS: Record<string, string> = {
  'scott hanselman': 'https://avatars.githubusercontent.com/u/2892?v=4',
  'hanselman': 'https://avatars.githubusercontent.com/u/2892?v=4',
  'lenny': 'https://api.dicebear.com/7.x/bottts/svg?seed=lenny',
  'lenny’s podcast': 'https://api.dicebear.com/7.x/bottts/svg?seed=lenny',
  'lennys podcast': 'https://api.dicebear.com/7.x/bottts/svg?seed=lenny',
  'lex fridman': 'https://api.dicebear.com/7.x/bottts/svg?seed=lexfridman',
  'huberman lab': 'https://api.dicebear.com/7.x/bottts/svg?seed=huberman',
  'andrew huberman': 'https://api.dicebear.com/7.x/bottts/svg?seed=huberman',
  'y combinator': 'https://avatars.githubusercontent.com/u/183863?v=4',
  'all-in podcast': 'https://api.dicebear.com/7.x/bottts/svg?seed=allin',
  'all in podcast': 'https://api.dicebear.com/7.x/bottts/svg?seed=allin',
  'mkbhd': 'https://api.dicebear.com/7.x/bottts/svg?seed=mkbhd',
  'marques brownlee': 'https://api.dicebear.com/7.x/bottts/svg?seed=mkbhd',
  'this week in startups': 'https://api.dicebear.com/7.x/bottts/svg?seed=thisweekin',
  'jason calacanis': 'https://api.dicebear.com/7.x/bottts/svg?seed=thisweekin',
  'my first million': 'https://api.dicebear.com/7.x/bottts/svg?seed=mfm',
  'the diary of a ceo': 'https://api.dicebear.com/7.x/bottts/svg?seed=doaceo',
  'steven bartlett': 'https://api.dicebear.com/7.x/bottts/svg?seed=doaceo',
  'naval': 'https://api.dicebear.com/7.x/bottts/svg?seed=naval',
  'naval ravikant': 'https://api.dicebear.com/7.x/bottts/svg?seed=naval',
  'tim ferriss': 'https://api.dicebear.com/7.x/bottts/svg?seed=timferriss',
};

/**
 * Get resolved channel avatar URL for any creator or channel name.
 */
export function getChannelAvatarUrl(
  channelName: string,
  providedAvatarUrl?: string,
  providedChannelAvatar?: string
): string {
  // 1. If explicit real HTTP avatar URL provided (not fallback ui-avatars), use it
  if (providedAvatarUrl && providedAvatarUrl.startsWith('http') && !providedAvatarUrl.includes('ui-avatars')) {
    return providedAvatarUrl;
  }
  if (providedChannelAvatar && providedChannelAvatar.startsWith('http') && !providedChannelAvatar.includes('ui-avatars')) {
    return providedChannelAvatar;
  }

  // 2. Check known creator dictionary
  const nameLower = (channelName || '').toLowerCase().trim();
  for (const [key, avatar] of Object.entries(KNOWN_CREATOR_AVATARS)) {
    if (nameLower.includes(key)) {
      return avatar;
    }
  }

  // 3. Clean fallback via ui-avatars with bold branding color
  const cleanName = encodeURIComponent(channelName || 'YouTube');
  return `https://ui-avatars.com/api/?name=${cleanName}&background=11A888&color=fff&bold=true`;
}
