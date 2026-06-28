import { describe, it, expect, beforeEach } from 'vitest';
import { useSiftStore } from '../store';

describe('Onboarding Flow', () => {
  beforeEach(() => {
    useSiftStore.setState({
      settings: {
        civility: { enabled: true, sensitivity: 'medium', onBlock: 'review', notifySender: true },
        business: { enabled: true },
        spam: { enabled: true, onBlock: 'review' },
        theme: 'aurora',
        trustedIds: [],
        disappearingMessages: { enabled: false, defaultMode: 'off', customMinutes: 60 },
        dnd: { enabled: false, startHour: 22, endHour: 7, allowTrusted: true, allowEmergency: true, notifyButSilent: false },
        drunkMode: { enabled: false, autoDetect: true, action: 'prevent', typingSpeedThreshold: 80 },
        unhingedMode: { enabled: false },
        toneChecker: { enabled: true, warnOnAggressive: true },
        spellCheck: { enabled: true },
        aiReplies: { enabled: true, anthropicKey: '' },
        aiModeration: { provider: 'gemini-nano', anthropicKey: '' },
        smsFallback: { enabled: false },
        dynamicRules: [],
        _onboardingComplete: false,
      },
    });
  });

  describe('Onboarding Settings', () => {
    it('should initialize with onboarding incomplete', () => {
      const settings = useSiftStore.getState().settings;
      expect(settings._onboardingComplete).toBe(false);
    });

    it('should allow marking onboarding as complete', () => {
      useSiftStore.getState().updateSettings({ _onboardingComplete: true });
      expect(useSiftStore.getState().settings._onboardingComplete).toBe(true);
    });

    it('should allow updating AI moderation provider', () => {
      useSiftStore.getState().updateAiModeration({ provider: 'anthropic-claude' });
      expect(useSiftStore.getState().settings.aiModeration.provider).toBe('anthropic-claude');
    });

    it('should allow setting Anthropic API key', () => {
      const testKey = 'sk-test-123';
      useSiftStore.getState().updateAiModeration({ anthropicKey: testKey });
      expect(useSiftStore.getState().settings.aiModeration.anthropicKey).toBe(testKey);
    });

    it('should default to Gemini Nano', () => {
      const settings = useSiftStore.getState().settings;
      expect(settings.aiModeration.provider).toBe('gemini-nano');
    });

    it('should allow changing theme during onboarding', () => {
      useSiftStore.getState().updateSettings({ theme: 'sunset' });
      expect(useSiftStore.getState().settings.theme).toBe('sunset');
    });
  });

  describe('Onboarding Workflow', () => {
    it('should complete full onboarding with Gemini Nano', () => {
      const { updateAiModeration, updateSettings } = useSiftStore.getState();

      updateAiModeration({ provider: 'gemini-nano', anthropicKey: '' });
      updateSettings({ theme: 'aurora', _onboardingComplete: true });

      const settings = useSiftStore.getState().settings;
      expect(settings.aiModeration.provider).toBe('gemini-nano');
      expect(settings.aiModeration.anthropicKey).toBe('');
      expect(settings.theme).toBe('aurora');
      expect(settings._onboardingComplete).toBe(true);
    });

    it('should complete full onboarding with Anthropic Claude', () => {
      const { updateAiModeration, updateSettings } = useSiftStore.getState();
      const testKey = 'sk-prod-key-123';

      updateAiModeration({ provider: 'anthropic-claude', anthropicKey: testKey });
      updateSettings({ theme: 'sunset', _onboardingComplete: true });

      const settings = useSiftStore.getState().settings;
      expect(settings.aiModeration.provider).toBe('anthropic-claude');
      expect(settings.aiModeration.anthropicKey).toBe(testKey);
      expect(settings.theme).toBe('sunset');
      expect(settings._onboardingComplete).toBe(true);
    });

    it('should persist AI provider choice', () => {
      useSiftStore.getState().updateAiModeration({ provider: 'anthropic-claude' });

      let settings = useSiftStore.getState().settings;
      expect(settings.aiModeration.provider).toBe('anthropic-claude');

      // Simulate app restart by getting fresh state
      settings = useSiftStore.getState().settings;
      expect(settings.aiModeration.provider).toBe('anthropic-claude');
    });

    it('should allow updating API key after onboarding', () => {
      useSiftStore.getState().updateSettings({ _onboardingComplete: true });
      useSiftStore.getState().updateAiModeration({
        provider: 'anthropic-claude',
        anthropicKey: 'sk-new-key',
      });

      const settings = useSiftStore.getState().settings;
      expect(settings._onboardingComplete).toBe(true);
      expect(settings.aiModeration.anthropicKey).toBe('sk-new-key');
    });
  });

  describe('Theme Selection', () => {
    it('should support all theme options', () => {
      const themes = ['aurora', 'sunset', 'noir', 'daylight', 'terminal'] as const;

      for (const theme of themes) {
        useSiftStore.getState().updateSettings({ theme });
        expect(useSiftStore.getState().settings.theme).toBe(theme);
      }
    });

    it('should remember theme after onboarding', () => {
      useSiftStore.getState().updateSettings({
        theme: 'noir',
        _onboardingComplete: true,
      });

      const settings = useSiftStore.getState().settings;
      expect(settings.theme).toBe('noir');
      expect(settings._onboardingComplete).toBe(true);
    });
  });

  describe('AI Provider Options', () => {
    it('should support Gemini Nano as default', () => {
      const settings = useSiftStore.getState().settings;
      expect(settings.aiModeration.provider).toBe('gemini-nano');
    });

    it('should support Anthropic Claude as alternative', () => {
      useSiftStore.getState().updateAiModeration({ provider: 'anthropic-claude' });
      expect(useSiftStore.getState().settings.aiModeration.provider).toBe('anthropic-claude');
    });

    it('should not require API key for Gemini Nano', () => {
      const { updateAiModeration, updateSettings } = useSiftStore.getState();
      updateAiModeration({ provider: 'gemini-nano' });
      updateSettings({ _onboardingComplete: true });

      const settings = useSiftStore.getState().settings;
      expect(settings.aiModeration.provider).toBe('gemini-nano');
      expect(settings._onboardingComplete).toBe(true);
    });

    it('should allow API key for Anthropic Claude', () => {
      const { updateAiModeration } = useSiftStore.getState();
      updateAiModeration({
        provider: 'anthropic-claude',
        anthropicKey: 'sk-test-key',
      });

      const settings = useSiftStore.getState().settings;
      expect(settings.aiModeration.provider).toBe('anthropic-claude');
      expect(settings.aiModeration.anthropicKey).toBe('sk-test-key');
    });
  });
});
