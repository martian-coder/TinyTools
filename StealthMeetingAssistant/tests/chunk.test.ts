import assert from 'node:assert/strict';
import test from 'node:test';
import { chunkBlocks, estimateTokens } from '../src/server/rag/chunk';
import { parseMarkdown } from '../src/server/rag/parse';

test('markdown headings become section metadata', () => {
  const { blocks } = parseMarkdown(
    '# Title\n\nIntro text.\n\n## Risks\n\nVendor contract unsigned.\n',
  );
  const risk = blocks.find((b) => b.text.includes('Vendor contract'));
  assert.equal(risk?.section, 'Risks');
});

test('chunks stay within the token budget', () => {
  const blocks = Array.from({ length: 60 }, (_, i) => ({
    text: `Paragraph ${i}. ${'word '.repeat(60)}`,
    section: 'Body',
  }));
  const chunks = chunkBlocks(blocks, { targetTokens: 300, overlapTokens: 40 });

  assert.ok(chunks.length > 1, 'long input should produce multiple chunks');
  for (const chunk of chunks) {
    // Overlap can push a chunk slightly past target; 1.6x is the sane ceiling.
    assert.ok(
      estimateTokens(chunk.text) <= 300 * 1.6,
      `chunk ${chunk.index} is ${estimateTokens(chunk.text)} tokens`,
    );
  }
});

test('consecutive chunks overlap so boundary sentences stay retrievable', () => {
  const blocks = Array.from({ length: 20 }, (_, i) => ({ text: `Sentence number ${i}.` }));
  const chunks = chunkBlocks(blocks, { targetTokens: 30, overlapTokens: 10 });

  assert.ok(chunks.length >= 2);
  const first = chunks[0].text.split('\n\n');
  const second = chunks[1].text.split('\n\n');
  assert.ok(
    second.some((line) => first.includes(line)),
    'second chunk should repeat the tail of the first',
  );
});

test('a single oversized block is split rather than dropped', () => {
  const huge = { text: 'x'.repeat(20_000) };
  const chunks = chunkBlocks([huge], { targetTokens: 200, overlapTokens: 20 });

  assert.ok(chunks.length > 1);
  const total = chunks.reduce((sum, c) => sum + c.text.length, 0);
  assert.ok(total >= 20_000, 'no content should be lost');
});

test('empty and whitespace-only blocks are discarded', () => {
  const chunks = chunkBlocks([{ text: '   ' }, { text: '' }, { text: 'real content' }]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text, 'real content');
});

test('page numbers survive chunking', () => {
  const chunks = chunkBlocks(
    [
      { text: 'Page one content.', page: 1 },
      { text: 'Page two content.', page: 2 },
    ],
    { targetTokens: 5, overlapTokens: 0 },
  );
  assert.ok(chunks.some((c) => c.page === 1));
  assert.ok(chunks.some((c) => c.page === 2));
});
