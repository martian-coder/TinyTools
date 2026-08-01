/**
 * Unicode formatting engine.
 *
 * LinkedIn feed posts accept plain text only — no HTML, no Markdown. The only way
 * to get visual bold/italic is to substitute characters from the Unicode
 * Mathematical Alphanumeric Symbols block (U+1D400–U+1D7FF), which LinkedIn passes
 * through untouched because they are just ordinary text characters.
 *
 * Most of the block is a clean offset from ASCII, but Unicode had already encoded
 * some of these glyphs in the BMP before the block existed, so those slots were left
 * unassigned. The EXCEPTIONS maps below patch those holes; without them you get
 * reserved code points that render as tofu boxes.
 */

const ASCII_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ASCII_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const ASCII_DIGIT = '0123456789';

/**
 * Builds a character map by offsetting from ASCII into a Unicode block.
 * Passing null for a base skips that character class, leaving it as-is.
 */
function buildMap({ upper, lower, digit, exceptions = {} }) {
  const map = {};
  const add = (chars, base) => {
    if (base === null || base === undefined) return;
    [...chars].forEach((ch, i) => {
      map[ch] = String.fromCodePoint(base + i);
    });
  };
  add(ASCII_UPPER, upper);
  add(ASCII_LOWER, lower);
  add(ASCII_DIGIT, digit);
  return { ...map, ...exceptions };
}

// Sans-serif variants match LinkedIn's own UI font most closely, so text formatted
// with them looks like emphasis rather than like a different typeface.
const BOLD = buildMap({ upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec });

const ITALIC = buildMap({ upper: 0x1d608, lower: 0x1d622, digit: null });

const BOLD_ITALIC = buildMap({ upper: 0x1d63c, lower: 0x1d656, digit: null });

// Serif bold reads as a heavier, more display-like weight — useful for headings.
const SERIF_BOLD = buildMap({ upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce });

const MONOSPACE = buildMap({ upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 });

const SCRIPT = buildMap({
  upper: 0x1d49c,
  lower: 0x1d4b6,
  digit: null,
  exceptions: {
    B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ',
    L: 'ℒ', M: 'ℳ', R: 'ℛ',
    e: 'ℯ', g: 'ℊ', o: 'ℴ',
  },
});

const DOUBLE_STRUCK = buildMap({
  upper: 0x1d538,
  lower: 0x1d552,
  digit: 0x1d7d8,
  exceptions: {
    C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ',
    Q: 'ℚ', R: 'ℝ', Z: 'ℤ',
  },
});

// Fullwidth forms add visual spacing between letters. Good for a rare accent line,
// terrible for anything longer — it roughly doubles the apparent width.
const FULLWIDTH = buildMap({ upper: 0xff21, lower: 0xff41, digit: 0xff10 });

// Combining marks stack onto the preceding character instead of replacing it.
const COMBINING_STRIKETHROUGH = '̶';
const COMBINING_UNDERLINE = '̲';

const MAPS = {
  bold: BOLD,
  italic: ITALIC,
  boldItalic: BOLD_ITALIC,
  serifBold: SERIF_BOLD,
  monospace: MONOSPACE,
  script: SCRIPT,
  doubleStruck: DOUBLE_STRUCK,
  fullwidth: FULLWIDTH,
};

/** Reverse lookup: styled character -> plain ASCII. Built once at module load. */
const TO_PLAIN = (() => {
  const reverse = {};
  Object.values(MAPS).forEach((map) => {
    Object.entries(map).forEach(([plain, styled]) => {
      reverse[styled] = plain;
    });
  });
  return reverse;
})();

/**
 * Applies a style to text. Characters with no mapping (punctuation, spaces,
 * emoji, non-Latin scripts) pass through unchanged.
 */
export function applyStyle(text, style) {
  if (!text) return '';
  if (style === 'plain') return stripStyle(text);

  if (style === 'strikethrough') {
    return [...text].map((ch) => (ch === '\n' ? ch : ch + COMBINING_STRIKETHROUGH)).join('');
  }
  if (style === 'underline') {
    return [...text].map((ch) => (ch === '\n' ? ch : ch + COMBINING_UNDERLINE)).join('');
  }

  const map = MAPS[style];
  if (!map) return text;
  return [...text].map((ch) => map[ch] || ch).join('');
}

/** Converts styled text back to plain ASCII, dropping combining marks. */
export function stripStyle(text) {
  if (!text) return '';
  return [...text]
    .filter((ch) => ch !== COMBINING_STRIKETHROUGH && ch !== COMBINING_UNDERLINE)
    .map((ch) => TO_PLAIN[ch] || ch)
    .join('');
}

/** True if the text contains any styled (non-ASCII-mapped) character. */
export function hasStyling(text) {
  if (!text) return false;
  return [...text].some(
    (ch) => TO_PLAIN[ch] || ch === COMBINING_STRIKETHROUGH || ch === COMBINING_UNDERLINE
  );
}

/** Fraction of letter/digit characters that are styled, 0–1. */
export function styledRatio(text) {
  const chars = [...text].filter((ch) => ch !== COMBINING_STRIKETHROUGH && ch !== COMBINING_UNDERLINE);
  const alphanumeric = chars.filter((ch) => /[a-z0-9]/i.test(TO_PLAIN[ch] || ch));
  if (alphanumeric.length === 0) return 0;
  const styled = alphanumeric.filter((ch) => TO_PLAIN[ch]);
  return styled.length / alphanumeric.length;
}

export const STYLES = [
  { id: 'bold', label: 'Bold', sample: 'Bold', description: 'Headlines and key points' },
  { id: 'italic', label: 'Italic', sample: 'Italic', description: 'Subtle emphasis, asides' },
  { id: 'boldItalic', label: 'Bold Italic', sample: 'Bold Italic', description: 'Strongest emphasis' },
  { id: 'serifBold', label: 'Serif Bold', sample: 'Serif Bold', description: 'Display-weight headings' },
  { id: 'underline', label: 'Underline', sample: 'Underline', description: 'Combining mark overlay' },
  { id: 'strikethrough', label: 'Strikethrough', sample: 'Strikethrough', description: 'Corrections, before/after' },
  { id: 'monospace', label: 'Monospace', sample: 'Monospace', description: 'Code, data, metrics' },
  { id: 'script', label: 'Script', sample: 'Script', description: 'Decorative — use sparingly' },
  { id: 'doubleStruck', label: 'Outline', sample: 'Outline', description: 'Decorative — use sparingly' },
  { id: 'fullwidth', label: 'Wide', sample: 'Wide', description: 'Spaced-out accent lines' },
];

/** Bullet and divider characters that survive LinkedIn's plain-text pipeline. */
export const SYMBOLS = {
  bullets: ['•', '◦', '▪', '‣', '→', '✓', '✔', '★', '➤', '–'],
  numbers: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'],
  dividers: ['━━━━━━━━━━', '──────────', '• • • • •', '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯', '＿＿＿＿＿'],
};
