import { describe, it, expect } from 'vitest';
import { detectThreat, normalize } from './engine';

describe('normalize', () => {
  it('undoes l33t, repeats and spacing', () => {
    expect(normalize('d0n’t  tell   y0ur    m0m')).toBe("don't tell your mom");
    expect(normalize('heyyyyy')).toBe('hey');
    expect(normalize('$end pic$')).toBe('send pics');
  });
});

describe('detectThreat — alert level', () => {
  const alerts: Array<[string, string]> = [
    ["don't tell your mom about this", 'grooming'],
    ['this is our little secret ok', 'grooming'],
    ['are you alone right now?', 'grooming'],
    ['delete this chat after reading', 'grooming'],
    ['send me a pic of yourself', 'photo-request'],
    ['what are you wearing', 'photo-request'],
    ['turn on your camera', 'photo-request'],
    ["i'll pick you up after school", 'meetup'],
    ["come to my place, don't bring anyone", 'meetup'],
    ['kill myself tonight', 'self-harm'],
    ['i just want to die', 'self-harm'],
    ['been cutting myself again', 'self-harm'],
  ];
  it.each(alerts)('%s → %s (alert)', (text, category) => {
    const hit = detectThreat(text);
    expect(hit).not.toBeNull();
    expect(hit!.category).toBe(category);
    expect(hit!.severity).toBe('alert');
  });

  it('catches obfuscated grooming (l33t + stretch)', () => {
    const hit = detectThreat('d0n’t tell y0ur parentsss');
    expect(hit?.category).toBe('grooming');
  });
});

describe('detectThreat — watch level', () => {
  const watches: Array<[string, string]> = [
    ["i'll buy you robux if you keep talking to me", 'lure'],
    ['how old are you', 'lure'],
    ['free v-bucks click here', 'lure'],
    ['you have won a prize! claim your reward', 'scam'],
    ['verify your account or it will be suspended', 'scam'],
    ['send your otp now', 'scam'],
    ['nobody likes you at school', 'bullying'],
    ["you're so ugly and pathetic", 'bullying'],
    ['everyone hates you', 'bullying'],
  ];
  it.each(watches)('%s → %s (watch)', (text, category) => {
    const hit = detectThreat(text);
    expect(hit).not.toBeNull();
    expect(hit!.category).toBe(category);
    expect(hit!.severity).toBe('watch');
  });

  it('"kill yourself" sent TO the kid is bullying-adjacent but must still fire', () => {
    // self-harm group lists /kill\s+(?:myself|me)/ — "kill yourself" is
    // caught by the bullying group instead.
    const hit = detectThreat('just kill yourself lol');
    expect(hit).not.toBeNull();
  });
});

describe('detectThreat — clean traffic stays clean', () => {
  const clean = [
    'see you at practice tomorrow',
    'mom said dinner at 7',
    'did you finish the math homework?',
    'gg that last round was insane',
    'happy birthday!! 🎉',
    'can you send the notes from class',
    'the movie starts at 8, meet us at the mall food court with everyone',
  ];
  it.each(clean)('%s → null', (text) => {
    expect(detectThreat(text)).toBeNull();
  });
});
