import type { SpellCheckSuggestion } from '../types';

// AI-inspired spell check that learns user's writing style from message history
export async function checkSpellingWithAI(text: string, userMessages?: string[]): Promise<SpellCheckSuggestion[]> {
  // Analyze user's style from recent messages
  const userStyle = analyzeUserStyle(userMessages || []);

  // Smart typo detection using pattern analysis
  const suggestions: SpellCheckSuggestion[] = [];
  const words = text.toLowerCase().split(/\s+/);
  const seen = new Set<string>();

  for (const word of words) {
    const cleaned = word.replace(/[.,!?;:]/g, '');
    if (seen.has(cleaned) || cleaned.length < 2) continue;
    seen.add(cleaned);

    const typoMatch = detectTypo(cleaned, userStyle);
    if (typoMatch) {
      suggestions.push(typoMatch);
    }
  }

  return suggestions;
}

// Learn user's writing patterns from their previous messages
function analyzeUserStyle(messages: string[]): UserStyle {
  const style: UserStyle = {
    usesCasualSlang: false,
    usesInternet: false,
    usesContractions: false,
    casualWords: new Set(),
    abbreviations: new Set(),
  };

  const combined = messages.join(' ').toLowerCase();

  // Detect patterns
  if (/\b(bruh|yo|dude|homie|fam|bro|nah|yea)\b/.test(combined)) {
    style.usesCasualSlang = true;
  }
  if (/\b(lol|omg|wtf|ngl|tbh|fr|smh|imo)\b/.test(combined)) {
    style.usesInternet = true;
  }
  if (/n't|'re|'ve|'ll|'d|'m/.test(combined)) {
    style.usesContractions = true;
  }

  // Extract commonly used casual words
  const casualMatches = combined.match(/\b(hey|sup|wassup|bruuh?|yo|dude|bro|sis|nah|yea|yeah|lol|omg)\b/g) || [];
  casualMatches.forEach(w => style.casualWords.add(w));

  return style;
}

interface UserStyle {
  usesCasualSlang: boolean;
  usesInternet: boolean;
  usesContractions: boolean;
  casualWords: Set<string>;
  abbreviations: Set<string>;
}

// Detect typos and suggest fixes that match user's style
function detectTypo(word: string, style: UserStyle): SpellCheckSuggestion | null {
  const suggestions = getTypoSuggestions(word);
  if (!suggestions) return null;

  // Pick suggestion that matches user's style
  let bestSuggestion = suggestions[0];
  for (const s of suggestions) {
    if (style.usesCasualSlang && isCasual(s)) {
      bestSuggestion = s;
      break;
    }
  }

  // Calculate confidence based on similarity
  const confidence = calculateSimilarity(word, bestSuggestion);

  return {
    original: word,
    suggested: bestSuggestion,
    reason: isCasual(bestSuggestion) ? 'typo' : 'typo',
    confidence: Math.min(confidence, 0.95),
  };
}

// Common typo patterns
function getTypoSuggestions(word: string): string[] | null {
  const typos: Record<string, string[]> = {
    'ubcan': ['bro can', 'you can'],
    'watsapp': ['wassup', 'what up'],
    'wud': ['would'],
    'ur': ['your'],
    'u': ['you'],
    'n': ['and'],
    'nd': ['and'],
    'tho': ['though'],
    'fr': ['for', 'for real'],
    'ngl': ['not gonna lie'],
    'tbh': ['to be honest'],
    'omg': ['oh my god'],
    'wtf': ['what the'],
    'bruh': ['bro'],
    'bruuh': ['bro'],
    'yea': ['yeah'],
    'ya': ['you'],
    'nah': ['no'],
    'dood': ['dude'],
    'cuz': ['because'],
    'bcuz': ['because'],
    'cnt': ['can\'t'],
    'wnt': ['won\'t'],
    'shld': ['should'],
    'thru': ['through'],
    'b4': ['before'],
    '2day': ['today'],
    '2nite': ['tonight'],
    'nite': ['night'],
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
    'kinda': ['kind of'],
    'sorta': ['sort of'],
    'gonna': ['going to'],
    'wanna': ['want to'],
    'gotta': ['got to'],
  };

  return typos[word] || null;
}

// Check if word/suggestion is casual/slang
function isCasual(word: string): boolean {
  const casual = new Set([
    'bro', 'yo', 'bruh', 'dude', 'nah', 'wassup', 'yeah',
    'for real', 'ngl', 'omg', 'wtf', 'lol', 'sure',
  ]);
  return casual.has(word.toLowerCase());
}

// Calculate how confident we are about the typo
function calculateSimilarity(original: string, corrected: string): number {
  // Levenshtein distance-inspired confidence
  const len = Math.max(original.length, corrected.length);
  const diff = Math.abs(original.length - corrected.length);
  return 1 - (diff / len) * 0.3; // 0.7-1.0 range
}

export function applySuggestion(text: string, original: string, suggested: string): string {
  const regex = new RegExp(`\\b${original}\\b`, 'gi');
  return text.replace(regex, suggested);
}
