import type { SpellCheckSuggestion } from '../types';

const TYPO_MAP: Record<string, string[]> = {
  'ubcan': ['bro can', 'you can'],
  'watsapp': ['wassup', 'what up'],
  'wud': ['would', 'wud up'],
  'ur': ['your', 'you are'],
  'u': ['you'],
  'n': ['and'],
  'nd': ['and'],
  'tho': ['though', 'tho'],
  'fr': ['for', 'for real'],
  'ngl': ['not gonna lie', 'ngl'],
  'tbh': ['to be honest', 'tbh'],
  'lol': ['lol'],
  'omg': ['oh my god', 'omg'],
  'wtf': ['what the', 'wtf'],
  'bruh': ['bro', 'bruh'],
  'bruuh': ['bro', 'bruh'],
  'yo': ['yo'],
  'yea': ['yeah', 'yes'],
  'ya': ['you', 'yeah'],
  'nah': ['nah', 'no'],
  'dude': ['dude'],
  'dood': ['dude'],
  'cuz': ['because', 'cuz'],
  'bcuz': ['because', 'cuz'],
  'cnt': ['can\'t', 'count'],
  'wnt': ['won\'t', 'want'],
  'shld': ['should'],
  'thru': ['through', 'thru'],
  'b4': ['before', 'b4'],
  '2day': ['today'],
  '2nite': ['tonight'],
  'nite': ['night', 'nite'],
  'tonite': ['tonight'],
  'tmrw': ['tomorrow'],
  'l8r': ['later'],
  'ppl': ['people'],
  'sry': ['sorry'],
  'thx': ['thanks'],
  'plz': ['please'],
  'luv': ['love'],
  'hv': ['have'],
  'dont': ['don\'t'],
  'aint': ['ain\'t'],
  'kinda': ['kind of', 'kinda'],
  'sorta': ['sort of', 'sorta'],
  'gonna': ['going to', 'gonna'],
  'wanna': ['want to', 'wanna'],
  'gotta': ['got to', 'gotta'],
  'cuz_long': ['cause', 'cuz'],
};

const CASUAL_WORDS = new Set([
  'hey', 'yo', 'bruh', 'dude', 'man', 'bro', 'sis', 'fam', 'homie',
  'sup', 'wassup', 'yo', 'lol', 'lmao', 'omg', 'wtf', 'ngl', 'fr', 'nah', 'yea', 'yeah'
]);

export function checkSpelling(text: string): SpellCheckSuggestion[] {
  const words = text.toLowerCase().split(/\s+/);
  const suggestions: SpellCheckSuggestion[] = [];
  const seen = new Set<string>();

  for (const word of words) {
    const cleaned = word.replace(/[.,!?;:]/g, '');

    if (seen.has(cleaned) || cleaned.length < 2) continue;
    seen.add(cleaned);

    if (TYPO_MAP[cleaned]) {
      const suggested = TYPO_MAP[cleaned][0];
      if (suggested !== cleaned) {
        suggestions.push({
          original: cleaned,
          suggested,
          reason: isCasualWord(suggested) ? 'casual' : 'typo',
          confidence: 0.85,
        });
      }
    }
  }

  return suggestions;
}

function isCasualWord(word: string): boolean {
  return CASUAL_WORDS.has(word.toLowerCase());
}

export function applySuggestion(text: string, original: string, suggested: string): string {
  const regex = new RegExp(`\\b${original}\\b`, 'gi');
  return text.replace(regex, suggested);
}

export function formatSuggestions(suggestions: SpellCheckSuggestion[]): string {
  if (suggestions.length === 0) return '';

  return suggestions
    .map(s => `"${s.original}" → "${s.suggested}"`)
    .join(', ');
}
