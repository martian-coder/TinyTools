// Drunk typing patterns detection
// Analyzes typing speed, caps lock ratio, common typos, and character patterns

interface TypingPattern {
  charCount: number;
  capsRatio: number;
  typingSpeed: number;
  typoScore: number;
  emojiiRatio: number;
}

const COMMON_TYPOS = [
  /\b(teh|hte|kinda|sorta)\b/gi,
  /(.)\1{3,}/g,
  /[A-Z]{4,}/g,
];

export function analyzeTypingPattern(text: string, typingTimeMs: number): TypingPattern {
  const charCount = text.length;
  const typingSpeed = charCount / (typingTimeMs / 1000);

  const capsCount = (text.match(/[A-Z]/g) || []).length;
  const capsRatio = charCount > 0 ? capsCount / charCount : 0;

  let typoScore = 0;
  COMMON_TYPOS.forEach(pattern => {
    const matches = text.match(pattern) || [];
    typoScore += matches.length * 0.1;
  });
  typoScore = Math.min(typoScore, 1);

  const emojiRegex = /(©|®|[ -㌀]|\ud83c[퀀-\udfff]|\ud83d[퀀-\udfff]|\ud83e[퀀-\udfff])/g;
  const emojiCount = (text.match(emojiRegex) || []).length;
  const emojiiRatio = charCount > 0 ? emojiCount / charCount : 0;

  return { charCount, capsRatio, typingSpeed, typoScore, emojiiRatio };
}

export function isDrunkTyping(pattern: TypingPattern, threshold: number = 80): boolean {
  // Score 0-100
  let score = 0;

  if (pattern.capsRatio > 0.3) score += 30;
  if (pattern.typoScore > 0.2) score += 25;
  if (pattern.typingSpeed > 60) score += 20;
  if (pattern.emojiiRatio > 0.1) score += 15;
  if (pattern.charCount > 200) score += 10;

  return score >= threshold;
}

export function getDrunkDetectionLevel(pattern: TypingPattern): 'none' | 'mild' | 'moderate' | 'high' {
  let score = 0;
  if (pattern.capsRatio > 0.3) score += 30;
  if (pattern.typoScore > 0.2) score += 25;
  if (pattern.typingSpeed > 60) score += 20;
  if (pattern.emojiiRatio > 0.1) score += 15;

  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'mild';
  return 'none';
}
