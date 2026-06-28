import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnthropicModerator } from '../moderation/anthropic';

describe('AnthropicModerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should return null if API key is missing', () => {
      const moderator = createAnthropicModerator('');
      expect(moderator).toBeNull();
    });

    it('should return null if API key is whitespace only', () => {
      const moderator = createAnthropicModerator('   ');
      expect(moderator).toBeNull();
    });

    it('should return moderator if API key is valid', () => {
      const moderator = createAnthropicModerator('sk-test-key');
      expect(moderator).not.toBeNull();
      expect(moderator?.name).toBe('anthropic-claude');
    });
  });

  describe('Availability', () => {
    it('should report as available with valid API key', async () => {
      const moderator = createAnthropicModerator('sk-test-key');
      const available = await moderator!.isAvailable();
      expect(available).toBe(true);
    });

    it('should report as unavailable without API key', async () => {
      const moderator = createAnthropicModerator('');
      expect(moderator).toBeNull();
    });
  });

  describe('Classification', () => {
    it('should use rules pre-filter for obvious cases', async () => {
      const moderator = createAnthropicModerator('sk-test-key');
      const verdict = await moderator!.classify('you are stupid', { sensitivity: 'medium' });

      expect(verdict.category).toBe('abusive');
      expect(verdict.engine).toBe('rules');
    });

    it('should classify business messages via rules', async () => {
      const moderator = createAnthropicModerator('sk-test-key');
      const verdict = await moderator!.classify('Your order #123 has shipped', { sensitivity: 'medium' });

      expect(verdict.category).toBe('business');
      expect(verdict.engine).toBe('rules');
    });

    it('should classify spam messages via rules', async () => {
      const moderator = createAnthropicModerator('sk-test-key');
      const verdict = await moderator!.classify('Forward this to 10 friends!', { sensitivity: 'medium' });

      expect(verdict.category).toBe('spam');
      expect(verdict.engine).toBe('rules');
    });

    it('should have name property', () => {
      const moderator = createAnthropicModerator('sk-test-key');
      expect(moderator?.name).toBe('anthropic-claude');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message with rules', async () => {
      const moderator = createAnthropicModerator('sk-test-key');
      const verdict = await moderator!.classify('', { sensitivity: 'medium' });

      expect(verdict).toBeDefined();
      expect(verdict.category).toBe('clean');
      expect(verdict.engine).toBe('rules');
    });

    it('should use low sensitivity for borderline cases', async () => {
      const moderator = createAnthropicModerator('sk-test-key');
      const verdict = await moderator!.classify('This might be abusive', { sensitivity: 'low' });

      expect(verdict).toBeDefined();
    });

    it('should use high sensitivity for borderline cases', async () => {
      const moderator = createAnthropicModerator('sk-test-key');
      const verdict = await moderator!.classify('This might be inappropriate', { sensitivity: 'high' });

      expect(verdict).toBeDefined();
    });
  });
});
