import type { DeliveryMetrics, TranscriptEvent } from '../../shared/types';

/**
 * Delivery stats computed locally from the transcript — pace, filler words,
 * how long you ran on, how much of the room you took.
 *
 * Deliberately not an LLM job: these are counting problems, the answers are
 * exact, and rehearsal feedback is more useful when it is instant and free.
 */

/**
 * Multi-word entries are matched as phrases. "like" is the noisy one — it is a
 * real word half the time ("something like that"), so it only counts when it
 * sits between pauses or before a comma, which is where the verbal tic lives.
 */
const FILLERS = [
  'um',
  'uh',
  'erm',
  'ah',
  'hmm',
  'you know',
  'i mean',
  'sort of',
  'kind of',
  'kinda',
  'sorta',
  'basically',
  'literally',
  'obviously',
  'honestly',
  'right?',
  'yeah no',
];

/** Speakers whose lines count as "yours". Mic audio is labelled "You". */
export function isSelf(speaker: string): boolean {
  return /^you\b/i.test(speaker.trim());
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countFillers(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const haystack = ` ${text.toLowerCase().replace(/[^\w\s?,']/g, ' ').replace(/\s+/g, ' ')} `;

  for (const filler of FILLERS) {
    // Word-boundary match so "um" does not fire inside "number".
    const pattern = new RegExp(`(?<![\\w'])${filler.replace(/\?/g, '\\?')}(?![\\w'])`, 'g');
    const found = haystack.match(pattern);
    if (found?.length) counts.set(filler, found.length);
  }

  // "like" only as a filler: bracketed by a comma or standing alone mid-phrase,
  // not in comparisons such as "works like a charm".
  const likeFiller = haystack.match(/(?<![\w'])like\s*,|,\s*like(?![\w'])/g);
  if (likeFiller?.length) counts.set('like', likeFiller.length);

  return counts;
}

export function deliveryMetrics(lines: TranscriptEvent[]): DeliveryMetrics {
  const mine = lines.filter((l) => l.isFinal !== false && isSelf(l.speaker));
  const everyone = lines.filter((l) => l.isFinal !== false);

  const myWords = mine.reduce((sum, l) => sum + countWords(l.text), 0);
  const allWords = everyone.reduce((sum, l) => sum + countWords(l.text), 0);

  const fillers = new Map<string, number>();
  for (const line of mine) {
    for (const [word, count] of countFillers(line.text)) {
      fillers.set(word, (fillers.get(word) ?? 0) + count);
    }
  }
  const fillerCount = [...fillers.values()].reduce((a, b) => a + b, 0);

  // Estimate speaking time from the span between your first and last line.
  // Timestamps mark when a line was finalised, so a single line has no span;
  // fall back to a typical speaking rate rather than reporting nonsense.
  let speakingSeconds = 0;
  if (mine.length >= 2) {
    speakingSeconds = Math.max(
      1,
      Math.round((mine[mine.length - 1].timestamp - mine[0].timestamp) / 1000),
    );
  } else if (myWords > 0) {
    speakingSeconds = Math.round((myWords / 150) * 60);
  }

  // Longest run of consecutive lines from you, uninterrupted by anyone else.
  let longestMonologueWords = 0;
  let run = 0;
  for (const line of everyone) {
    if (isSelf(line.speaker)) {
      run += countWords(line.text);
      longestMonologueWords = Math.max(longestMonologueWords, run);
    } else {
      run = 0;
    }
  }

  return {
    wordsPerMinute: speakingSeconds > 0 ? Math.round((myWords / speakingSeconds) * 60) : 0,
    wordCount: myWords,
    speakingSeconds,
    fillerCount,
    fillerRate: myWords > 0 ? Number(((fillerCount / myWords) * 100).toFixed(1)) : 0,
    topFillers: [...fillers.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    longestMonologueWords,
    talkRatio: allWords > 0 ? Number((myWords / allWords).toFixed(2)) : 0,
  };
}

/**
 * A one-line summary for the prompt, included only when something is actually
 * off. Feeding "you spoke at a normal pace" to the model just invites it to
 * comment on nothing.
 */
export function deliveryNote(metrics: DeliveryMetrics): string | undefined {
  const notes: string[] = [];
  // Comfortable conversational range is roughly 130-170 wpm.
  if (metrics.wordsPerMinute > 185) notes.push(`speaking fast (${metrics.wordsPerMinute} wpm)`);
  if (metrics.wordsPerMinute > 0 && metrics.wordsPerMinute < 105) {
    notes.push(`speaking slowly (${metrics.wordsPerMinute} wpm)`);
  }
  if (metrics.fillerRate > 3 && metrics.fillerCount >= 3) {
    const worst = metrics.topFillers[0];
    notes.push(`${metrics.fillerCount} filler words${worst ? ` (mostly "${worst.word}")` : ''}`);
  }
  if (metrics.longestMonologueWords > 220) {
    notes.push(`one answer ran ${metrics.longestMonologueWords} words without a pause`);
  }
  if (metrics.talkRatio > 0.8 && metrics.wordCount > 120) {
    notes.push(`took ${Math.round(metrics.talkRatio * 100)}% of the talking`);
  }
  return notes.length ? notes.join('; ') : undefined;
}
