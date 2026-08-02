/**
 * LinkedIn's published field limits.
 *
 * The post limit is what the Checks tab enforces, but people draft headlines,
 * About sections and connection notes in the same box, and those cut off far
 * sooner — a 300-character connection note is the one that catches people out.
 */
export const LIMITS = [
  { id: 'post', name: 'Post', limit: 3000, fold: 200 },
  { id: 'comment', name: 'Comment', limit: 1250 },
  { id: 'headline', name: 'Headline', limit: 220 },
  { id: 'about', name: 'About', limit: 2600, fold: 300 },
  { id: 'note', name: 'Connection note', limit: 300 },
  { id: 'message', name: 'Message', limit: 8000 },
];

export const DEFAULT_LIMIT = LIMITS[0];

export function limitById(id) {
  return LIMITS.find((l) => l.id === id) || DEFAULT_LIMIT;
}
