import { useState } from 'react';
import { useSiftStore } from '../store';
import { THEMES } from '../theme';
import type { ThemeName } from '../types';

/**
 * First-run flow after registration. Everyone starts on the free Strenes
 * managed AI (our Gemini key, no setup) so people experience full-quality
 * filtering and Commander immediately — no upfront "pick a provider"
 * decision. Commander itself prompts for a personal API key later, once
 * the free quota is actually used up (see cloud.ts / Commander.tsx).
 */
export function Onboarding() {
  const [step, setStep] = useState<'welcome' | 'theme' | 'complete'>('welcome');
  const [selectedTheme, setSelectedTheme] = useState<ThemeName>('ios');
  const { updateAiModeration, updateSettings, setScreen } = useSiftStore();

  const handleFinish = () => {
    updateAiModeration({ provider: 'gemini-nano', anthropicKey: '' });
    updateSettings({ theme: selectedTheme });

    const settings = useSiftStore.getState().settings;
    updateSettings({ ...settings, _onboardingComplete: true });

    setScreen('chats');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[var(--base)] to-[var(--base-dark)] p-4">
      <div className="w-full max-w-2xl">
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-[var(--text)]">Welcome to Strenes</h1>
            <p className="text-lg text-[var(--text-secondary)]">
              Intelligent message filtering, on-device — with free AI-powered filtering and Commander built in, no setup needed.
            </p>
            <button
              onClick={() => setStep('theme')}
              className="px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold"
            >
              Get Started
            </button>
          </div>
        )}

        {step === 'theme' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-[var(--text)]">Choose Your Theme</h2>
            <p className="text-[var(--text-secondary)]">
              Personalize your experience:
            </p>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(THEMES).map(([name, _]) => (
                <button
                  key={name}
                  onClick={() => {
                    setSelectedTheme(name as any);
                    updateSettings({ theme: name as any }); // live preview of the choice
                  }}
                  className={`p-3 rounded-lg border-2 transition text-left flex items-center justify-between ${
                    selectedTheme === name
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  <div className="capitalize font-semibold text-[var(--text)]">{name}</div>
                  {selectedTheme === name && <span className="text-[var(--accent)]">✓</span>}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg font-semibold hover:bg-[var(--surface-hover)]"
              >
                Back
              </button>
              <button
                onClick={() => setStep('complete')}
                className="flex-1 px-4 py-3 bg-[var(--accent)] text-white rounded-lg font-semibold hover:bg-[var(--accent-hover)]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center space-y-6">
            <div className="text-5xl">✓</div>
            <h2 className="text-3xl font-bold text-[var(--text)]">All Set!</h2>
            <p className="text-[var(--text-secondary)]">
              You're on free Strenes AI — message filtering and Commander work right away, no key needed.
              <br />
              If you're a heavy user, we'll let you know when it's worth adding your own free API key for unlimited use.
            </p>
            <button
              onClick={handleFinish}
              className="px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold w-full"
            >
              Start Using Strenes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
