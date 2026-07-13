import { describe, it, expect } from 'vitest';
import { finishSentence } from './analyst';

describe('finishSentence', () => {
  it('keeps complete answers untouched', () => {
    expect(finishSentence('All quiet this week. Sleep well.')).toBe('All quiet this week. Sleep well.');
    expect(finishSentence('Is that serious? Yes!')).toBe('Is that serious? Yes!');
    expect(finishSentence('He said "our secret."')).toBe('He said "our secret."');
  });

  it('trims a truncated trailing sentence back to the last boundary', () => {
    expect(finishSentence('One scam flag three days ago. It was filed to the digest. Three days ago, on'))
      .toBe('One scam flag three days ago. It was filed to the digest.');
  });

  it('keeps text when there is no earlier boundary to cut back to', () => {
    const t = 'The most concerning flags';
    expect(finishSentence(t)).toBe(t);
  });

  it('does not cut down to a uselessly short fragment', () => {
    // Only boundary is very early — keep the full text instead.
    const t = 'Hi. The most concerning flag from xX_gamerguy22 was the secrecy pressure on';
    expect(finishSentence(t)).toBe(t);
  });

  it('handles empty and whitespace input', () => {
    expect(finishSentence('')).toBe('');
    expect(finishSentence('   ')).toBe('');
  });
});
