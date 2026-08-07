import assert from 'node:assert/strict';
import test from 'node:test';
import { detectFocus, focusGuidance } from '../src/server/prompts/intent';
import { systemPrompt } from '../src/server/prompts/modes';
import type { TranscriptEvent } from '../src/shared/types';

function said(text: string): TranscriptEvent[] {
  return [{ speaker: 'Meeting', text, isFinal: true, timestamp: Date.now() }];
}

test('an explicit quick action always wins over text heuristics', () => {
  // The message looks documentary, but the action is unambiguous.
  assert.equal(
    detectFocus({ message: 'what does the spec say', action: 'critique' }),
    'coaching',
  );
  assert.equal(detectFocus({ message: 'the api timeout', action: 'suggest-reply' }), 'reply');
});

test('asking what to say routes to a sayable reply', () => {
  for (const message of [
    'what should I say?',
    'how do I respond to that',
    'help me reply to this',
    'what do i tell them',
  ]) {
    assert.equal(detectFocus({ message }), 'reply', message);
  }
});

test('questions about the attached material route to documents', () => {
  for (const message of [
    'what does the spec say about timeouts',
    'according to the contract, when does it renew',
    'is that in the doc',
  ]) {
    assert.equal(detectFocus({ message }), 'documents', message);
  }
});

test('technical vocabulary routes to technical', () => {
  assert.equal(detectFocus({ message: 'why is p99 latency so high' }), 'technical');
  assert.equal(detectFocus({ message: 'should we roll back the migration' }), 'technical');
});

test('an ambiguous question reads the room', () => {
  // Nothing technical in the question itself...
  assert.equal(detectFocus({ message: 'what do you think' }), 'general');
  // ...but the discussion has been technical, so follow it.
  assert.equal(
    detectFocus({
      message: 'what do you think',
      transcript: said('the endpoint returns a 500 after the schema migration'),
    }),
    'technical',
  );
});

test('retrieved documents ground an otherwise unclaimed question', () => {
  assert.equal(detectFocus({ message: 'what do you think', hasDocumentContext: true }), 'documents');
  // But an explicit "what should I say" still beats having documents around.
  assert.equal(
    detectFocus({ message: 'what should i say', hasDocumentContext: true }),
    'reply',
  );
});

test('a new topic with no signals falls back to general footing', () => {
  const focus = detectFocus({
    message: 'they just brought up a rebrand for Q4, no idea what that involves',
  });
  assert.equal(focus, 'general');
  // General guidance must help someone who is new to the topic.
  assert.match(focusGuidance(focus), /new client|new manager|unfamiliar/i);
  assert.match(focusGuidance(focus), /confirm/i);
});

test('every focus produces distinct, non-empty guidance', () => {
  const focuses = ['documents', 'technical', 'reply', 'coaching', 'general'] as const;
  const texts = focuses.map(focusGuidance);
  for (const text of texts) assert.ok(text.trim().length > 40);
  assert.equal(new Set(texts).size, focuses.length, 'guidance must not be duplicated');
});

test('auto mode folds the focus guidance into the system prompt', () => {
  const auto = systemPrompt('auto', undefined, 'reply');
  assert.match(auto, /MODE: ADAPTIVE/);
  assert.match(auto, /speak as-is/);
  // Safety rules survive the addition.
  assert.match(auto, /untrusted/i);
});

test('an explicitly chosen mode is never overridden by the detected focus', () => {
  // The user picked Technical; a documents focus must not rewrite it.
  const technical = systemPrompt('technical', undefined, 'documents');
  assert.match(technical, /MODE: TECHNICAL/);
  assert.doesNotMatch(technical, /cite every claim/i);
  assert.equal(technical, systemPrompt('technical'));
});

test('auto is the fallback for an unknown mode', () => {
  assert.match(systemPrompt('nonsense' as never), /MODE: ADAPTIVE/);
});

test('empty input never throws', () => {
  assert.equal(detectFocus({ message: '' }), 'general');
  assert.equal(detectFocus({ message: '', transcript: [] }), 'general');
});
