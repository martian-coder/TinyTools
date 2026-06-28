import { describe, it, expect, beforeEach } from 'vitest';
import { useSiftStore } from '../store';

describe('Store - State Management', () => {
  beforeEach(() => {
    useSiftStore.setState({
      contacts: [
        { id: 'maya', name: 'Maya', trusted: false, grad: '', isEmergency: false },
        { id: 'dad', name: 'Dad', trusted: true, grad: '', isEmergency: false },
      ],
      messages: [],
      settings: {
        civility: { enabled: true, sensitivity: 'medium', onBlock: 'review', notifySender: true },
        business: { enabled: true },
        spam: { enabled: true, onBlock: 'review' },
        theme: 'daylight',
        trustedIds: ['dad'],
        disappearingMessages: { enabled: false, defaultMode: 'off' },
        dnd: { enabled: false, startHour: 22, endHour: 7, allowTrusted: true, allowEmergency: true, notifyButSilent: false },
        drunkMode: { enabled: false, autoDetect: true, action: 'prevent', typingSpeedThreshold: 80 },
        unhingedMode: { enabled: false },
        toneChecker: { enabled: true, warnOnAggressive: true },
        spellCheck: { enabled: true },
        aiReplies: { enabled: true, anthropicKey: '' },
        aiModeration: { provider: 'gemini-nano', anthropicKey: '' },
        smsFallback: { enabled: false },
        dynamicRules: [],
      },
      activeScreen: 'chats',
      activeFolder: 'primary',
      activeContactId: null,
      pendingAsk: null,
      revealed: {},
      banner: null,
    });
  });

  describe('Dynamic Rules Management', () => {
    it('should add a dynamic rule', () => {
      const { addDynamicRule, settings } = useSiftStore.getState();
      expect(settings.dynamicRules.length).toBe(0);

      addDynamicRule('maya', 'mentions money', 'block');

      const updatedSettings = useSiftStore.getState().settings;
      expect(updatedSettings.dynamicRules.length).toBe(1);
      expect(updatedSettings.dynamicRules[0].contactId).toBe('maya');
      expect(updatedSettings.dynamicRules[0].condition).toBe('mentions money');
      expect(updatedSettings.dynamicRules[0].action).toBe('block');
    });

    it('should remove a dynamic rule', () => {
      const { addDynamicRule, removeDynamicRule } = useSiftStore.getState();
      addDynamicRule('maya', 'mentions money', 'block');

      const ruleId = useSiftStore.getState().settings.dynamicRules[0].id;
      removeDynamicRule(ruleId);

      expect(useSiftStore.getState().settings.dynamicRules.length).toBe(0);
    });

    it('should toggle a dynamic rule', () => {
      const { addDynamicRule, toggleDynamicRule } = useSiftStore.getState();
      addDynamicRule('maya', 'mentions money', 'block');

      const rule = useSiftStore.getState().settings.dynamicRules[0];
      expect(rule.enabled).toBe(true);

      toggleDynamicRule(rule.id);

      const updatedRule = useSiftStore.getState().settings.dynamicRules[0];
      expect(updatedRule.enabled).toBe(false);
    });

    it('should update a dynamic rule', () => {
      const { addDynamicRule, updateDynamicRule } = useSiftStore.getState();
      addDynamicRule('maya', 'mentions money', 'block');

      const ruleId = useSiftStore.getState().settings.dynamicRules[0].id;
      updateDynamicRule(ruleId, { condition: 'mentions payment', action: 'review' });

      const updatedRule = useSiftStore.getState().settings.dynamicRules[0];
      expect(updatedRule.condition).toBe('mentions payment');
      expect(updatedRule.action).toBe('review');
    });

    it('should get rules for a specific contact', () => {
      const { addDynamicRule, getDynamicRulesForContact } = useSiftStore.getState();

      addDynamicRule('maya', 'mentions money', 'block');
      addDynamicRule('maya', 'discusses politics', 'review');
      addDynamicRule('dad', 'asks for help', 'block');

      const mayaRules = getDynamicRulesForContact('maya');
      expect(mayaRules.length).toBe(2);
      expect(mayaRules.every(r => r.contactId === 'maya')).toBe(true);

      const dadRules = getDynamicRulesForContact('dad');
      expect(dadRules.length).toBe(1);
    });

    it('should only return enabled rules', () => {
      const { addDynamicRule, toggleDynamicRule, getDynamicRulesForContact } = useSiftStore.getState();

      addDynamicRule('maya', 'rule 1', 'block');
      addDynamicRule('maya', 'rule 2', 'review');

      const ruleId = useSiftStore.getState().settings.dynamicRules[0].id;
      toggleDynamicRule(ruleId);

      const activeRules = getDynamicRulesForContact('maya');
      expect(activeRules.length).toBe(1);
      expect(activeRules[0].condition).toBe('rule 2');
    });
  });

  describe('Message Management', () => {
    it('should send a message', () => {
      const { sendMessage } = useSiftStore.getState();
      sendMessage('maya', 'Hello', 'ip');

      const messages = useSiftStore.getState().messages;
      expect(messages.length).toBe(1);
      expect(messages[0].text).toBe('Hello');
      expect(messages[0].dir).toBe('out');
    });

    it('should approve a message', () => {
      const { receiveMessage } = useSiftStore.getState();
      receiveMessage('maya', 'Test', { folder: 'review', status: 'held' }, {
        category: 'clean',
        confidence: 1,
        engine: 'rules',
      });

      const msgId = useSiftStore.getState().messages[0].id;
      useSiftStore.getState().approveMessage(msgId);

      const approvedMsg = useSiftStore.getState().messages[0];
      expect(approvedMsg.status).toBe('approved');
    });

    it('should reject a message', () => {
      const { receiveMessage } = useSiftStore.getState();
      receiveMessage('maya', 'Test', { folder: 'review', status: 'held' }, {
        category: 'clean',
        confidence: 1,
        engine: 'rules',
      });

      const msgId = useSiftStore.getState().messages[0].id;
      useSiftStore.getState().rejectMessage(msgId);

      const rejectedMsg = useSiftStore.getState().messages[0];
      expect(rejectedMsg.status).toBe('rejected');
    });
  });

  describe('Trust Management', () => {
    it('should toggle contact trusted status', () => {
      const { toggleTrusted } = useSiftStore.getState();
      let contact = useSiftStore.getState().contacts.find(c => c.id === 'maya');
      expect(contact?.trusted).toBe(false);

      toggleTrusted('maya');

      contact = useSiftStore.getState().contacts.find(c => c.id === 'maya');
      expect(contact?.trusted).toBe(true);
    });

    it('should set contact trusted status', () => {
      const { setContactTrusted } = useSiftStore.getState();

      setContactTrusted('maya', true);
      let contact = useSiftStore.getState().contacts.find(c => c.id === 'maya');
      expect(contact?.trusted).toBe(true);

      setContactTrusted('maya', false);
      contact = useSiftStore.getState().contacts.find(c => c.id === 'maya');
      expect(contact?.trusted).toBe(false);
    });
  });

  describe('Screen Navigation', () => {
    it('should set active screen', () => {
      const { setScreen } = useSiftStore.getState();
      expect(useSiftStore.getState().activeScreen).toBe('chats');

      setScreen('commander');
      expect(useSiftStore.getState().activeScreen).toBe('commander');
    });

    it('should open conversation', () => {
      const { openConversation } = useSiftStore.getState();
      openConversation('maya');

      expect(useSiftStore.getState().activeContactId).toBe('maya');
      expect(useSiftStore.getState().activeScreen).toBe('conversation');
    });
  });

  describe('Settings Management', () => {
    it('should update civility settings', () => {
      const { updateCivility } = useSiftStore.getState();
      updateCivility({ sensitivity: 'high' });

      const civility = useSiftStore.getState().settings.civility;
      expect(civility.sensitivity).toBe('high');
    });

    it('should toggle spam filter', () => {
      const { updateSpam } = useSiftStore.getState();
      updateSpam({ enabled: false });

      expect(useSiftStore.getState().settings.spam.enabled).toBe(false);
    });
  });
});
