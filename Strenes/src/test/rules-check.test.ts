import { describe, it, expect } from 'vitest';
import { checkRuleMatch } from '../moderation/rules-check';
import type { DynamicRule } from '../types';

describe('Rule Matching - Heuristic Fallback', () => {
  describe('Keyword Extraction', () => {
    it('should match messages mentioning keywords', async () => {
      const rule: DynamicRule = {
        id: 'rule1',
        contactId: 'maya',
        condition: 'mentions money',
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      const result = await checkRuleMatch('Can you lend me some money?', rule, '');
      expect(result.matches).toBe(true);
    });

    it('should not match unrelated messages', async () => {
      const rule: DynamicRule = {
        id: 'rule1',
        contactId: 'maya',
        condition: 'mentions money',
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      const result = await checkRuleMatch('Hey, how are you doing today?', rule, '');
      expect(result.matches).toBe(false);
    });
  });

  describe('Topic Matching', () => {
    it('should detect money-related messages when rule includes "money"', async () => {
      const rule: DynamicRule = {
        id: 'rule1',
        contactId: 'dad',
        condition: 'discusses money',
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      const messages = [
        'I need cash urgently',
        'Can you pay the bill?',
        'Invoice is due tomorrow',
      ];

      for (const msg of messages) {
        const result = await checkRuleMatch(msg, rule, '');
        expect(result.matches).toBe(true);
      }
    });

    it('should detect political messages when rule includes "politics"', async () => {
      const rule: DynamicRule = {
        id: 'rule2',
        contactId: 'aunt',
        condition: 'talks about politics',
        action: 'review',
        enabled: true,
        createdAt: Date.now(),
      };

      const messages = [
        'Vote for candidate X',
        'The election is here',
        'Republican debate today',
      ];

      for (const msg of messages) {
        const result = await checkRuleMatch(msg, rule, '');
        expect(result.matches).toBe(true);
      }
    });

    it('should detect religious messages', async () => {
      const rule: DynamicRule = {
        id: 'rule3',
        contactId: 'friend',
        condition: 'religion',
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      const messages = [
        'Join our church this Sunday',
        'God bless you',
        'Spiritual awakening article',
        'Faith-based conversation',
      ];

      for (const msg of messages) {
        const result = await checkRuleMatch(msg, rule, '');
        expect(result.matches).toBe(true);
      }
    });

    it('should detect work-related messages', async () => {
      const rule: DynamicRule = {
        id: 'rule4',
        contactId: 'personal',
        condition: 'work',
        action: 'review',
        enabled: true,
        createdAt: Date.now(),
      };

      const messages = [
        'Meeting at 2pm',
        'My boss is difficult',
        'Deadline tomorrow',
        'Project update needed',
      ];

      for (const msg of messages) {
        const result = await checkRuleMatch(msg, rule, '');
        expect(result.matches).toBe(true);
      }
    });
  });

  describe('Condition Parsing', () => {
    it('should handle multiple keywords with OR', async () => {
      const rule: DynamicRule = {
        id: 'rule1',
        contactId: 'contact',
        condition: 'mentions money or payment',
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      expect(await checkRuleMatch('I need money', rule, '')).toMatchObject({ matches: true });
      expect(await checkRuleMatch('Send payment', rule, '')).toMatchObject({ matches: true });
      expect(await checkRuleMatch('Hello there', rule, '')).toMatchObject({ matches: false });
    });
  });

  describe('Edge Cases', () => {
    it('should be case insensitive', async () => {
      const rule: DynamicRule = {
        id: 'rule1',
        contactId: 'contact',
        condition: 'mentions MONEY',
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      const result = await checkRuleMatch('i need some cash and money', rule, '');
      expect(result.matches).toBe(true);
    });

    it('should handle empty messages', async () => {
      const rule: DynamicRule = {
        id: 'rule1',
        contactId: 'contact',
        condition: 'mentions money',
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      const result = await checkRuleMatch('', rule, '');
      expect(result.matches).toBe(false);
    });

    it('should handle special characters', async () => {
      const rule: DynamicRule = {
        id: 'rule1',
        contactId: 'contact',
        condition: "mentions \"important\"",
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      const result = await checkRuleMatch('This is important info', rule, '');
      expect(result.matches).toBe(true);
    });
  });

  describe('Reason Messages', () => {
    it('should provide reason for matches', async () => {
      const rule: DynamicRule = {
        id: 'rule1',
        contactId: 'contact',
        condition: 'money',
        action: 'block',
        enabled: true,
        createdAt: Date.now(),
      };

      const result = await checkRuleMatch('I need money', rule, '');
      expect(result.reason).toBeTruthy();
      expect(result.reason).toContain('financial');
    });
  });
});
