import { describe, it, expect } from 'vitest';
import { parseIntent } from '../moderation/commander';
import type { Contact, Message } from '../types';

const SEED_CONTACTS: Contact[] = [
  { id: 'maya', name: 'Maya', trusted: false, grad: '' },
  { id: 'dad', name: 'Dad', trusted: true, grad: '' },
  { id: 'quickcart', name: 'QuickCart', trusted: false, grad: '' },
  { id: 'megadeals', name: 'MegaDeals', trusted: false, grad: '' },
];

const SEED_MESSAGES: Message[] = [];

describe('Commander - Intent Parsing', () => {
  describe('Reply Intent', () => {
    it('should parse reply commands', async () => {
      const intent = await parseIntent('reply Maya yes', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('reply');
      expect(intent.contactName).toBe('Maya');
      expect(intent.text).toBe('yes');
    });

    it('should handle various reply keywords', async () => {
      const commands = [
        'reply Maya hello',
        'respond to Dad thanks',
        'tell QuickCart ok',
        'message Maya test',
        'send Dad message',
      ];

      for (const cmd of commands) {
        const intent = await parseIntent(cmd, SEED_CONTACTS, SEED_MESSAGES, '');
        expect(intent.type).toBe('reply');
        expect(intent.contactId).toBeTruthy();
      }
    });
  });

  describe('Open Intent', () => {
    it('should parse open commands', async () => {
      const intent = await parseIntent('open Maya', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('open');
      expect(intent.contactName).toBe('Maya');
    });

    it('should handle various open keywords', async () => {
      const commands = ['open Dad', 'show Maya', 'read Dad', 'view Maya', 'check Dad'];
      for (const cmd of commands) {
        const intent = await parseIntent(cmd, SEED_CONTACTS, SEED_MESSAGES, '');
        expect(intent.type).toBe('open');
      }
    });
  });

  describe('Approve/Reject Intent', () => {
    it('should parse approve commands', async () => {
      const intent = await parseIntent('approve all', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('approve');
    });

    it('should parse reject commands', async () => {
      const intent = await parseIntent('reject all', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('reject');
    });
  });

  describe('Dynamic Rules', () => {
    it('should parse block rules with mentions', async () => {
      const intent = await parseIntent('block Maya mentions money', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('dynamic_rule');
      expect(intent.contactName).toBe('Maya');
      expect(intent.condition).toContain('money');
      expect(intent.ruleAction).toBe('block');
    });

    it('should parse review rules', async () => {
      const intent = await parseIntent('review Dad when discussing work', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('dynamic_rule');
      expect(intent.contactName).toBe('Dad');
      expect(intent.ruleAction).toBe('review');
    });

    it('should handle dont allow variant', async () => {
      const intent = await parseIntent("don't allow QuickCart when asking payment", SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('dynamic_rule');
      expect(intent.contactName).toBe('QuickCart');
      expect(intent.ruleAction).toBe('block');
    });

    it('should parse various block keywords', async () => {
      const commands = [
        'block Maya mentions money',
        'prevent Dad if discussing payment',
        'disallow MegaDeals when talking shipping',
        'don\'t allow QuickCart when discussing politics',
      ];

      for (const cmd of commands) {
        const intent = await parseIntent(cmd, SEED_CONTACTS, SEED_MESSAGES, '');
        expect(intent.type).toBe('dynamic_rule');
        expect(intent.action).toBe('add');
        expect(intent.contactId).toBeTruthy();
        expect(intent.condition).toBeTruthy();
      }
    });
  });

  describe('Query Intent', () => {
    it('should parse capability queries', async () => {
      const commands = ['help', 'what can you do', 'capabilities', 'commands'];
      for (const cmd of commands) {
        const intent = await parseIntent(cmd, SEED_CONTACTS, SEED_MESSAGES, '');
        expect(intent.type).toBe('query');
        expect(intent.subject).toBe('capabilities');
      }
    });

    it('should parse held count queries', async () => {
      const intent = await parseIntent('how many held', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('query');
      expect(intent.subject).toBe('held_count');
    });

    it('should parse contact message queries', async () => {
      const intent = await parseIntent('messages from Maya', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('query');
      expect(intent.subject).toBe('contact_messages');
      expect(intent.contactName).toBe('Maya');
    });

    it('should parse summary queries', async () => {
      const commands = ['summary', 'briefing', "what's new", 'catch me up'];
      for (const cmd of commands) {
        const intent = await parseIntent(cmd, SEED_CONTACTS, SEED_MESSAGES, '');
        expect(intent.type).toBe('query');
        expect(intent.subject).toBe('summary');
      }
    });
  });

  describe('Trust Intent', () => {
    it('should parse trust commands', async () => {
      const intent = await parseIntent('trust Maya', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('set_rule');
      expect(intent.rule).toBe('trust');
      expect(intent.contactName).toBe('Maya');
    });

    it('should parse distrust commands', async () => {
      const intent = await parseIntent("don't trust Dad", SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('set_rule');
      expect(intent.rule).toBe('distrust');
    });
  });

  describe('Unknown Intent', () => {
    it('should handle unrecognized commands', async () => {
      const intent = await parseIntent('xyz123 unknown command', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.type).toBe('unknown');
    });
  });

  describe('Contact Matching', () => {
    it('should match exact contact names', async () => {
      const intent = await parseIntent('open Maya', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.contactId).toBe('maya');
    });

    it('should handle partial name matches', async () => {
      const intent = await parseIntent('open meg', SEED_CONTACTS, SEED_MESSAGES, '');
      expect(intent.contactName).toContain('Mega');
    });

    it('should be case insensitive', async () => {
      const commands = ['open maya', 'open MAYA', 'open MaYa'];
      for (const cmd of commands) {
        const intent = await parseIntent(cmd, SEED_CONTACTS, SEED_MESSAGES, '');
        expect(intent.contactId).toBe('maya');
      }
    });
  });
});
