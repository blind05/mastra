import { describe, it, expect } from 'vitest';

import { ContentSimilarityScorer } from './index';

describe('ContentSimilarityScorer', () => {
  const scorer = new ContentSimilarityScorer();

  it('should return perfect similarity for identical strings', async () => {
    const result = await scorer.score({ input: 'The quick brown fox', output: 'The quick brown fox' });
    expect(result.score).toBe(1);
    expect(result.info?.similarity).toBe(1);
  });

  it('should handle case differences with default options', async () => {
    const result = await scorer.score({ input: 'The Quick Brown Fox', output: 'the quick brown fox' });
    expect(result.score).toBe(1);
  });

  it('should handle whitespace differences with default options', async () => {
    const result = await scorer.score({ input: 'The   quick\nbrown    fox', output: 'The quick brown fox' });
    expect(result.score).toBe(1);
  });

  it('should be case sensitive when ignoreCase is false', async () => {
    const caseSensitiveScorer = new ContentSimilarityScorer({ ignoreCase: false });
    const result = await caseSensitiveScorer.score({ input: 'The Quick Brown FOX', output: 'the quick brown fox' });
    expect(result.score).toBeLessThan(0.8);
  });

  it('should preserve whitespace differences when ignoreWhitespace is true', async () => {
    const whitespaceScorer = new ContentSimilarityScorer({
      ignoreCase: true,
      ignoreWhitespace: true,
    });
    const result = await whitespaceScorer.score({ input: 'The\tquick  brown\n\nfox', output: 'The quick brown fox' });
    expect(result.score).toBe(1);
  });

  it('should handle both case and whitespace sensitivity', async () => {
    const sensitiveScorer = new ContentSimilarityScorer({
      ignoreCase: false,
      ignoreWhitespace: true,
    });
    const result = await sensitiveScorer.score({ input: 'The\tQuick  Brown\n\nFOX', output: 'the quick brown fox' });
    expect(result.score).toBeLessThan(0.8);
  });

  it('should handle partial similarity', async () => {
    const result = await scorer.score({
      input: 'The quick brown fox jumps over the lazy dog',
      output: 'The quick brown fox runs past the lazy dog',
    });
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.score).toBeLessThan(0.8);
  });

  it('should handle completely different strings', async () => {
    const result = await scorer.score({ input: 'The quick brown fox', output: 'Lorem ipsum dolor sit amet' });
    expect(result.score).toBeLessThan(0.3);
  });

  it('should handle empty strings', async () => {
    const result = await scorer.score({ input: '', output: '' });
    expect(result.score).toBe(1);
  });

  it('should handle one empty string', async () => {
    const result = await scorer.score({ input: 'The quick brown fox', output: '' });
    expect(result.score).toBe(0);
  });

  it('should include similarity details in result', async () => {
    const result = await scorer.score({ input: 'The quick brown fox', output: 'The quick brown fox' });
    expect(result.info).toEqual({ similarity: 1 });
  });
});
