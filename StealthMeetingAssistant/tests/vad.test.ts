import assert from 'node:assert/strict';
import test from 'node:test';
import { frameRms, pcmToWav, Vad } from '../src/server/stt/vad';
import { isHallucination } from '../src/server/stt/whisperBatch';
import { SAMPLE_RATE } from '../src/server/stt/types';

/** Generate `ms` of 16 kHz mono PCM16 at a given peak amplitude. */
function tone(ms: number, amplitude: number): Buffer {
  const samples = Math.floor((SAMPLE_RATE * ms) / 1000);
  const buffer = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    // 220 Hz sine — voice-ish, and never a constant DC level.
    buffer.writeInt16LE(Math.round(Math.sin((i / SAMPLE_RATE) * 220 * 2 * Math.PI) * amplitude), i * 2);
  }
  return buffer;
}

const SILENCE = (ms: number) => tone(ms, 40); // room tone, not digital zero
const SPEECH = (ms: number) => tone(ms, 8000);

test('rms separates speech from room tone', () => {
  assert.ok(frameRms(SPEECH(20)) > frameRms(SILENCE(20)) * 10);
  assert.equal(frameRms(Buffer.alloc(0)), 0);
});

test('a speech burst followed by silence produces exactly one segment', () => {
  const vad = new Vad({ hangoverMs: 400 });
  const segments = [
    ...vad.push(SILENCE(500)),
    ...vad.push(SPEECH(1200)),
    ...vad.push(SILENCE(600)),
  ];

  assert.equal(segments.length, 1);
  // Segment carries the speech plus preroll and trailing silence.
  assert.ok(segments[0].durationMs >= 1200, `got ${segments[0].durationMs}ms`);
  assert.ok(segments[0].pcm.length > 0);
});

test('two utterances separated by a pause produce two segments', () => {
  const vad = new Vad({ hangoverMs: 400 });
  const segments = [
    ...vad.push(SILENCE(400)),
    ...vad.push(SPEECH(800)),
    ...vad.push(SILENCE(700)),
    ...vad.push(SPEECH(800)),
    ...vad.push(SILENCE(700)),
  ];
  assert.equal(segments.length, 2);
});

test('continuous speech is cut at maxSegmentMs so text is not withheld forever', () => {
  const vad = new Vad({ maxSegmentMs: 1000 });
  const segments = vad.push(SPEECH(3500));
  assert.ok(segments.length >= 3, `expected >=3 cuts, got ${segments.length}`);
});

test('silence alone never produces a segment', () => {
  const vad = new Vad();
  const segments = [...vad.push(SILENCE(3000)), ...vad.push(SILENCE(3000))];
  assert.equal(segments.length, 0);
  assert.equal(vad.flush(), undefined);
});

test('a click shorter than minSegmentMs is discarded', () => {
  const vad = new Vad({ minSegmentMs: 400, hangoverMs: 200 });
  const segments = [
    ...vad.push(SILENCE(300)),
    ...vad.push(SPEECH(60)),
    ...vad.push(SILENCE(400)),
  ];
  assert.equal(segments.length, 0);
});

test('PCM split across arbitrary buffer boundaries yields the same result', () => {
  const audio = Buffer.concat([SILENCE(400), SPEECH(1000), SILENCE(700)]);

  const whole = new Vad({ hangoverMs: 400 }).push(audio);

  // Feed the identical audio in ragged 333-byte pieces, which straddle frames.
  const split = new Vad({ hangoverMs: 400 });
  const pieces: ReturnType<typeof split.push> = [];
  for (let i = 0; i < audio.length; i += 333) {
    pieces.push(...split.push(audio.subarray(i, i + 333)));
  }

  assert.equal(whole.length, 1);
  assert.equal(pieces.length, 1);
  // Frame alignment can differ by at most one 20 ms frame.
  assert.ok(Math.abs(whole[0].durationMs - pieces[0].durationMs) <= 20);
});

test('flush emits the in-progress utterance when capture stops mid-sentence', () => {
  const vad = new Vad();
  vad.push(SILENCE(300));
  vad.push(SPEECH(900));
  assert.equal(vad.isSpeaking, true);

  const tail = vad.flush();
  assert.ok(tail, 'the final utterance must not be dropped on stop');
  assert.ok(tail!.durationMs >= 900);
  assert.equal(vad.isSpeaking, false);
});

test('the VAD adapts to a noisy room instead of firing on the noise floor', () => {
  const vad = new Vad({ hangoverMs: 400 });
  // Loud, steady background — below the speech level but well above silence.
  const noise = tone(2000, 900);
  assert.equal(vad.push(noise).length, 0, 'steady background must not trigger');

  const segments = [...vad.push(tone(900, 9000)), ...vad.push(noise)];
  assert.equal(segments.length, 1, 'real speech over that noise must still trigger');
});

/* ── WAV encoding ────────────────────────────────────────────── */

test('pcmToWav writes a header the STT endpoints can read', () => {
  const pcm = SPEECH(100);
  const wav = pcmToWav(pcm);

  assert.equal(wav.length, pcm.length + 44);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  assert.equal(wav.readUInt32LE(4), pcm.length + 36);
  assert.equal(wav.readUInt16LE(20), 1, 'format must be PCM');
  assert.equal(wav.readUInt16LE(22), 1, 'must be mono');
  assert.equal(wav.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(wav.readUInt32LE(28), SAMPLE_RATE * 2, 'byte rate');
  assert.equal(wav.readUInt16LE(32), 2, 'block align');
  assert.equal(wav.readUInt16LE(34), 16, 'bit depth');
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.ok(wav.subarray(44).equals(pcm), 'audio must be byte-identical');
});

/* ── Whisper hallucination filter ────────────────────────────── */

test('stock Whisper silence-hallucinations are filtered out', () => {
  for (const phrase of ['Thank you.', 'you', 'Thanks for watching!', 'Subtitles by the Amara.org community']) {
    assert.equal(isHallucination(phrase, 3000), true, phrase);
  }
});

test('a long segment yielding two words is treated as noise', () => {
  assert.equal(isHallucination('Okay sure', 8000), true);
  // ...but the same words from a short clip are plausibly real.
  assert.equal(isHallucination('Okay sure', 1200), false);
});

test('real speech is never filtered', () => {
  assert.equal(
    isHallucination('The timeout is fifteen seconds with two retries.', 5000),
    false,
  );
});
