import { SYMBOLS } from './unicode.js';

/**
 * List toggling.
 *
 * LinkedIn does not turn "-" or "*" into a list — there is no list markup at all.
 * A list is literally a bullet character pasted at the start of each line, so
 * toggling one is a text transform over the lines the selection touches.
 */

const BULLET = /^\s*[•◦▪‣→✓✔★➤–-]\s+/u;
const NUMBER = /^\s*(?:\d+[.)]|[1-9]️?⃣|🔟)\s+/u;

const strip = (line) => line.replace(BULLET, '').replace(NUMBER, '');

/** Expands an arbitrary selection to the whole lines it covers. */
export function lineRange(text, start, end) {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = text.indexOf('\n', end);
  const to = nextBreak === -1 ? text.length : nextBreak;
  return { from, to };
}

/**
 * Adds list markers to the selected lines, or removes them when every non-empty
 * line already carries one — the same toggle behaviour a word processor has.
 *
 * Returns the replacement text for the expanded line range.
 */
export function toggleList(block, kind) {
  const lines = block.split('\n');
  const filled = lines.filter((l) => l.trim());
  if (!filled.length) return block;

  const pattern = kind === 'number' ? NUMBER : BULLET;
  const alreadyListed = filled.every((l) => pattern.test(l));

  if (alreadyListed) return lines.map(strip).join('\n');

  let counter = 0;
  return lines
    .map((line) => {
      if (!line.trim()) return line;
      const bare = strip(line);
      if (kind === 'bullet') return `• ${bare}`;
      counter += 1;
      // Numbered emoji only exist up to ten; fall back to plain numerals.
      return `${SYMBOLS.numbers[counter - 1] || `${counter}.`} ${bare}`;
    })
    .join('\n');
}
