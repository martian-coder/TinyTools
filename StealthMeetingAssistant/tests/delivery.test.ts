import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countFillers,
  countWords,
  deliveryMetrics,
  deliveryNote,
  isSelf,
} from '../src/server/session/delivery';
import type { TranscriptEvent } from '../src/shared/types';

const t0 = 1_700_000_000_000;

function line(speaker: string, text: string, secondsIn: number): TranscriptEvent {
  return { speaker, text, isFinal: true, timestamp: t0 + secondsIn * 1000 };
}

test('mic lines are recognised as the user, others are not', () => {
  assert.equal(isSelf('You'), true);
  assert.equal(isSelf('You · Speaker 2'), true);
  assert.equal(isSelf('Meeting'), false);
  assert.equal(isSelf('Youssef'), false, 'a name starting with "You" is not you');
});

test('filler detection ignores the same letters inside real words', () => {
  const counts = countFillers('The number of umbrellas, um, is basically uh three.');
  assert.equal(counts.get('um'), 1, '"number"/"umbrellas" must not count');
  assert.equal(counts.get('uh'), 1);
  assert.equal(counts.get('basically'), 1);
});

test('"like" counts as a filler only when it is one', () => {
  // Comparison, not a tic.
  assert.equal(countFillers('it works like a charm').get('like'), undefined);
  // Verbal tic, bracketed by commas.
  assert.equal(countFillers('it was, like, really slow').get('like'), 1);
});

test('multi-word fillers are matched as phrases', () => {
  const counts = countFillers('you know, it was sort of fine, i mean mostly');
  assert.equal(counts.get('you know'), 1);
  assert.equal(counts.get('sort of'), 1);
  assert.equal(counts.get('i mean'), 1);
});

test('metrics count only your own speech', () => {
  const metrics = deliveryMetrics([
    line('You', 'I think the timeout should be fifteen seconds', 0),
    line('Meeting', 'Why fifteen and not ten, what is the reasoning here exactly', 10),
    line('You', 'Because the gateway p99 is four seconds', 20),
  ]);

  assert.equal(metrics.wordCount, 15, 'only your words');
  assert.equal(metrics.speakingSeconds, 20);
  assert.equal(metrics.wordsPerMinute, 45);
  assert.ok(metrics.talkRatio > 0.4 && metrics.talkRatio < 0.6);
});

test('the longest monologue resets when someone else speaks', () => {
  const metrics = deliveryMetrics([
    line('You', 'one two three four five', 0),
    line('You', 'six seven eight nine ten', 5),
    line('Meeting', 'hold on', 10),
    line('You', 'eleven twelve', 15),
  ]);
  assert.equal(metrics.longestMonologueWords, 10, 'the interruption ends the run');
});

test('a single line still reports a sane pace rather than dividing by zero', () => {
  const metrics = deliveryMetrics([line('You', 'just one short line here', 0)]);
  assert.ok(metrics.speakingSeconds > 0);
  assert.ok(Number.isFinite(metrics.wordsPerMinute));
  assert.ok(metrics.wordsPerMinute > 0);
});

test('an empty transcript produces zeroes, not NaN', () => {
  const metrics = deliveryMetrics([]);
  assert.deepEqual(
    [metrics.wordsPerMinute, metrics.fillerRate, metrics.talkRatio, metrics.wordCount],
    [0, 0, 0, 0],
  );
  assert.equal(deliveryNote(metrics), undefined);
});

test('interim lines are excluded so partial results are not double counted', () => {
  const metrics = deliveryMetrics([
    { speaker: 'You', text: 'the time', isFinal: false, timestamp: t0 },
    line('You', 'the timeout is fifteen seconds', 5),
  ]);
  assert.equal(metrics.wordCount, 5);
});

test('the delivery note stays silent when delivery is fine', () => {
  const lines: TranscriptEvent[] = [];
  // ~150 wpm, no fillers, alternating speakers.
  for (let i = 0; i < 10; i++) {
    lines.push(line('You', 'we should ship behind the flag at five percent first', i * 4));
    lines.push(line('Meeting', 'agreed that seems sensible to me as an approach', i * 4 + 2));
  }
  assert.equal(deliveryNote(deliveryMetrics(lines)), undefined);
});

test('the delivery note names specific problems when there are some', () => {
  const lines: TranscriptEvent[] = [
    line('You', `um so basically ${'word '.repeat(60)} you know uh i mean`, 0),
    line('You', `sort of ${'word '.repeat(60)} um uh basically`, 5),
  ];
  const note = deliveryNote(deliveryMetrics(lines));
  assert.ok(note, 'problems should be reported');
  assert.match(note!, /filler/);
  // Two lines five seconds apart with 130+ words is a very fast pace.
  assert.match(note!, /fast|wpm/);
});

test('a long uninterrupted answer is flagged', () => {
  const note = deliveryNote(
    deliveryMetrics([
      line('You', 'word '.repeat(150), 0),
      line('You', 'word '.repeat(150), 60),
    ]),
  );
  assert.match(note!, /without a pause/);
});

test('countWords ignores surrounding whitespace', () => {
  assert.equal(countWords('   '), 0);
  assert.equal(countWords(' one  two   three '), 3);
});
