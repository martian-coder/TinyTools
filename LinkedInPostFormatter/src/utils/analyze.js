import { stripStyle, styledRatio, hasStyling } from './unicode.js';

// LinkedIn's published cap for feed posts.
export const CHAR_LIMIT = 3000;

// The feed collapses a post after roughly this many characters and shows "…see more".
// Mobile truncates earlier than desktop, so the mobile number is the one to design for.
export const TRUNCATE_DESKTOP = 210;
export const TRUNCATE_MOBILE = 140;

// LinkedIn's renderer collapses runs of blank lines beyond this.
const MAX_CONSECUTIVE_BLANKS = 2;

const segmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * Counts what a reader perceives as one character. Emoji built from several code
 * points (flags, skin-tone modifiers, ZWJ families) count once here but far more
 * against LinkedIn's limit — see `counts` below for both numbers.
 */
export function graphemeCount(text) {
  if (!text) return 0;
  if (segmenter) return [...segmenter.segment(text)].length;
  return [...text].length;
}

export function counts(text) {
  const graphemes = graphemeCount(text);
  const codePoints = [...text].length;
  // UTF-16 length is the pessimistic bound: astral characters (all the styled ones)
  // occupy two units each.
  const utf16 = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split('\n').length : 0;
  return { graphemes, codePoints, utf16, words, lines };
}

/** Text visible in the feed before the reader has to tap "see more". */
export function hookText(text, limit = TRUNCATE_MOBILE) {
  const flat = text.replace(/\n+/g, ' ');
  return [...flat].slice(0, limit).join('');
}

function findStyledHashtags(text) {
  // Hashtags survive styling visually but LinkedIn indexes the literal characters,
  // so a styled tag is a tag nobody can follow or find.
  const matches = text.match(/#[^\s#]+/g) || [];
  return matches.filter((tag) => hasStyling(tag));
}

function findStyledUrls(text) {
  const matches = text.match(/\bhttps?:\/\/\S+|\bwww\.\S+/g) || [];
  return matches.filter((url) => hasStyling(url));
}

function longestBlankRun(text) {
  const runs = text.match(/\n{2,}/g) || [];
  return runs.reduce((max, run) => Math.max(max, run.length - 1), 0);
}

function longParagraphs(text) {
  // Roughly one rendered mobile line per 60 characters.
  return text
    .split(/\n{2,}/)
    .map((p, i) => ({ index: i, text: p, estimatedLines: Math.ceil(p.length / 60) }))
    .filter((p) => p.estimatedLines > 4);
}

function countEmoji(text) {
  const matches = text.match(/\p{Extended_Pictographic}/gu) || [];
  return matches.length;
}

/**
 * Runs every check and returns findings sorted worst-first.
 * Severity: 'error' blocks a good post, 'warning' costs reach, 'info' is a nudge.
 */
export function analyze(text) {
  const findings = [];
  const c = counts(text);
  const plain = stripStyle(text);
  const ratio = styledRatio(text);
  const emoji = countEmoji(text);

  if (!text.trim()) return { findings, counts: c, ratio, emoji, plain };

  // --- Length ---
  if (c.utf16 > CHAR_LIMIT) {
    findings.push({
      id: 'over-limit',
      severity: 'error',
      title: `Over LinkedIn's ${CHAR_LIMIT.toLocaleString()}-character limit`,
      detail: `This post is ${c.utf16.toLocaleString()} characters as LinkedIn counts them — ${(
        c.utf16 - CHAR_LIMIT
      ).toLocaleString()} too many. Styled characters take two slots each, which is usually the reason a post that looks short gets rejected.`,
    });
  } else if (c.utf16 > CHAR_LIMIT * 0.9) {
    findings.push({
      id: 'near-limit',
      severity: 'warning',
      title: 'Close to the character limit',
      detail: `${c.utf16.toLocaleString()} of ${CHAR_LIMIT.toLocaleString()} used. Adding more styling will push this over — each styled character costs two.`,
    });
  }

  if (c.utf16 > 0 && c.utf16 < 400) {
    findings.push({
      id: 'very-short',
      severity: 'info',
      title: 'Short post',
      detail:
        'Text-only posts tend to travel furthest between roughly 1,200 and 2,000 characters. Short posts can work, but they need a strong hook to earn the dwell time.',
    });
  }

  // --- Accessibility ---
  if (ratio > 0.3) {
    findings.push({
      id: 'accessibility-heavy',
      severity: 'warning',
      title: `${Math.round(ratio * 100)}% of your text is styled`,
      detail:
        'Styled characters are not letters — screen readers often spell out their Unicode names or skip them entirely. Someone using assistive technology may hear gibberish instead of your post. Keep styling to headlines and a few key phrases; aim for under 30%.',
    });
  } else if (ratio > 0 && ratio <= 0.3) {
    findings.push({
      id: 'accessibility-ok',
      severity: 'info',
      title: 'Styling is within a reasonable range',
      detail: `${Math.round(
        ratio * 100
      )}% styled. Screen readers will still struggle with the styled runs, so keep the plain-text version carrying the meaning.`,
    });
  }

  // --- Discoverability ---
  const styledTags = findStyledHashtags(text);
  if (styledTags.length) {
    findings.push({
      id: 'styled-hashtags',
      severity: 'error',
      title: `${styledTags.length} hashtag${styledTags.length > 1 ? 's' : ''} styled — they won't work`,
      detail: `LinkedIn matches hashtags on the literal characters, so ${styledTags
        .slice(0, 3)
        .join(', ')} won't be clickable or appear in any feed. Select each one and set it back to plain.`,
    });
  }

  const styledUrls = findStyledUrls(text);
  if (styledUrls.length) {
    findings.push({
      id: 'styled-urls',
      severity: 'error',
      title: 'A styled link will not be clickable',
      detail:
        'LinkedIn auto-links URLs by matching plain characters. Styled URLs stay inert text, and nobody can copy them into a browser either. Set links back to plain.',
    });
  }

  if (ratio > 0.15) {
    findings.push({
      id: 'seo-keywords',
      severity: 'info',
      title: 'Keep searchable terms plain',
      detail:
        "LinkedIn search indexes literal characters. Any term you'd want someone to find you by — your role, product, skill — should stay unstyled even if it sits in a styled line.",
    });
  }

  // --- Structure ---
  const blanks = longestBlankRun(text);
  if (blanks > MAX_CONSECUTIVE_BLANKS) {
    findings.push({
      id: 'blank-runs',
      severity: 'warning',
      title: `${blanks} blank lines in a row will be collapsed`,
      detail:
        'LinkedIn trims runs of blank lines when it renders the post, so the spacing you see in the editor is not what publishes. Use the Fix Spacing button to normalise this.',
    });
  }

  const paragraphs = longParagraphs(text);
  if (paragraphs.length) {
    findings.push({
      id: 'long-paragraphs',
      severity: 'warning',
      title: `${paragraphs.length} paragraph${paragraphs.length > 1 ? 's' : ''} will read as a wall of text`,
      detail:
        'On a phone these run past four lines. Posts that hold attention break every one or two sentences — the white space is doing as much work as the words.',
    });
  }

  // --- Hook ---
  const firstLine = text.split('\n')[0] || '';
  if (c.utf16 > TRUNCATE_MOBILE && firstLine.length > TRUNCATE_MOBILE) {
    findings.push({
      id: 'hook-length',
      severity: 'warning',
      title: 'Your first line gets cut off',
      detail: `Mobile truncates at about ${TRUNCATE_MOBILE} characters, and the cut lands mid-sentence. Put a complete, curiosity-creating thought in the first line and break after it.`,
    });
  }

  // --- Emoji ---
  if (emoji > 8) {
    findings.push({
      id: 'emoji-heavy',
      severity: 'warning',
      title: `${emoji} emoji is past the point of diminishing returns`,
      detail:
        'Engagement lift flattens after two or three and reverses when a post reads as decorated. Screen readers also announce every one by name, which is exhausting to listen to.',
    });
  } else if (emoji === 0 && c.utf16 > 500) {
    findings.push({
      id: 'emoji-none',
      severity: 'info',
      title: 'No emoji',
      detail:
        'One or two well-placed emoji tend to lift reach slightly and give the eye somewhere to rest. Entirely optional — plenty of strong posts use none.',
    });
  }

  // --- Call to action ---
  const tail = plain.slice(-220).toLowerCase();
  const hasQuestion = tail.includes('?');
  const hasAsk = /\b(comment|share|thoughts|agree|what do you|let me know|dm|follow|repost|tell me)\b/.test(
    tail
  );
  if (c.utf16 > 600 && !hasQuestion && !hasAsk) {
    findings.push({
      id: 'no-cta',
      severity: 'info',
      title: 'No closing question or ask',
      detail:
        'Posts that end with a genuine question collect more comments, and comments are what push a post back into the feed. A real question beats "thoughts?".',
    });
  }

  const order = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return { findings, counts: c, ratio, emoji, plain };
}

/**
 * Normalises spacing to what LinkedIn will actually render: trailing whitespace
 * removed, blank-line runs capped, leading and trailing blank lines dropped.
 */
export function fixSpacing(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}
