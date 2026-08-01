/**
 * Block model for the composer.
 *
 * A post is a list of blocks, each compiled to plain text and joined with a blank
 * line. Blocks exist so the *shape* of a post can be rearranged without retyping
 * it — the order of hook, evidence and ask is most of what makes a post work.
 */

const NUMBER_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const lines = (content) =>
  content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

// Leading bullet characters a user may have typed themselves, which we strip
// before adding our own so nothing ends up double-marked.
const EXISTING_BULLET = /^([•◦▪‣→✓✔★➤–-]|\d+[.)]|[1-9]️?⃣|🔟)\s*/u;

export const BLOCK_TYPES = {
  hook: {
    label: 'Hook',
    hint: 'The first line. This is the whole ad — everything else is only read if this earns it.',
    placeholder: 'I got the email at 4pm on a Friday.',
    compile: (c) => c.trim(),
  },
  paragraph: {
    label: 'Paragraph',
    hint: 'One or two sentences. Longer than that reads as a wall on a phone.',
    placeholder: 'Write a short paragraph. Keep it to one idea.',
    compile: (c) => c.trim(),
  },
  list: {
    label: 'Bullet list',
    hint: 'One item per line. Bullets are added for you.',
    placeholder: 'First point\nSecond point\nThird point',
    compile: (c) => lines(c).map((l) => `• ${l.replace(EXISTING_BULLET, '')}`).join('\n'),
  },
  numbered: {
    label: 'Numbered list',
    hint: 'One item per line. Numbered emoji up to ten, then plain numbers.',
    placeholder: 'First lesson\nSecond lesson\nThird lesson',
    compile: (c) =>
      lines(c)
        .map((l, i) => `${NUMBER_EMOJI[i] || `${i + 1}.`} ${l.replace(EXISTING_BULLET, '')}`)
        .join('\n'),
  },
  data: {
    label: 'Metric',
    hint: 'One number per line. Concrete figures are what make a post credible.',
    placeholder: 'Revenue: £40k (up 22%)\nChurn: 3.1% (down from 5.4%)',
    compile: (c) => lines(c).map((l) => `📊 ${l.replace(/^📊\s*/, '')}`).join('\n'),
  },
  quote: {
    label: 'Quote',
    hint: 'Something someone actually said. Attribute it on the last line.',
    placeholder: 'The bug was a mistake. Waiting would have been a decision.',
    compile: (c) => {
      const l = lines(c);
      if (!l.length) return '';
      // LinkedIn has no blockquote, so curly quotes carry the attribution instead.
      return `“${l.join(' ')}”`;
    },
  },
  divider: {
    label: 'Divider',
    hint: 'A visual break. One per post at most — more and it reads as decoration.',
    placeholder: '',
    compile: () => '━━━━━━━━━━',
    noContent: true,
  },
  cta: {
    label: 'Closing ask',
    hint: 'A real question. Comments are what push a post back into the feed.',
    placeholder: "What's the most expensive lesson your work has taught you?",
    compile: (c) => c.trim(),
  },
  hashtags: {
    label: 'Hashtags',
    hint: 'Three to five. These are left unstyled on purpose — LinkedIn cannot match a styled tag.',
    placeholder: 'hiring engineering leadership',
    compile: (c) =>
      c
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#+/, '').trim())
        .filter(Boolean)
        .map((t) => `#${t}`)
        .join(' '),
  },
};

export const BLOCK_ORDER = [
  'hook',
  'paragraph',
  'list',
  'numbered',
  'data',
  'quote',
  'divider',
  'cta',
  'hashtags',
];

let counter = 0;
export function makeBlock(type, content = '') {
  counter += 1;
  return { id: `b${Date.now()}_${counter}`, type, content };
}

/** Joins compiled blocks with a blank line, dropping any that produce nothing. */
export function compileBlocks(blocks) {
  return blocks
    .map((b) => {
      const spec = BLOCK_TYPES[b.type];
      return spec ? spec.compile(b.content || '') : '';
    })
    .filter((text) => text.trim())
    .join('\n\n');
}

/** Pure reorder used by both drag-and-drop and the keyboard controls. */
export function moveBlock(blocks, from, to) {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) {
    return blocks;
  }
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** A sensible starting post so the composer is never an empty screen. */
export function starterBlocks() {
  return [
    makeBlock('hook', ''),
    makeBlock('paragraph', ''),
    makeBlock('list', ''),
    makeBlock('cta', ''),
  ];
}
