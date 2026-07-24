import { useState } from 'react';
import { useSiftStore } from '../store';
import { THEMES } from '../theme';

export function Onboarding() {
  const [step, setStep] = useState<'welcome' | 'ai-provider' | 'api-key' | 'theme' | 'complete'>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<'gemini-nano' | 'anthropic-claude'>('gemini-nano');
  const [apiKey, setApiKey] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<'aurora' | 'sunset' | 'noir' | 'daylight' | 'terminal'>('aurora');
  const { updateAiModeration, updateSettings, setScreen } = useSiftStore();

  const handleFinish = () => {
    if (selectedProvider === 'anthropic-claude' && !apiKey.trim()) {
      alert('Please enter your API key for Anthropic Claude');
      return;
    }

    updateAiModeration({
      provider: selectedProvider,
      anthropicKey: selectedProvider === 'anthropic-claude' ? apiKey.trim() : '',
    });

    updateSettings({ theme: selectedTheme });

    // Mark onboarding as complete
    const settings = useSiftStore.getState().settings;
    updateSettings({
      ...settings,
      _onboardingComplete: true,
    });

    setScreen('chats');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[var(--base)] to-[var(--base-dark)] p-4">
      <div className="w-full max-w-2xl">
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-[var(--text)]">Welcome to Strenes</h1>
            <p className="text-lg text-[var(--text-secondary)]">
              Intelligent message filtering that runs entirely on your device.
            </p>
            <button
              onClick={() => setStep('ai-provider')}
              className="px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold"
            >
              Get Started
            </button>
          </div>
        )}

        {step === 'ai-provider' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-[var(--text)]">Choose Your AI Provider</h2>
            <p className="text-[var(--text-secondary)]">
              Select how you want message filtering to work:
            </p>

            <div className="space-y-4">
              <button
                onClick={() => setSelectedProvider('gemini-nano')}
                className={`w-full p-4 rounded-lg border-2 transition ${
                  selectedProvider === 'gemini-nano'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                <div className="text-left flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text)]">Google Gemini Nano (Recommended)</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Free, on-device, no account needed. Perfect for most users.
                    </p>
                  </div>
                  {selectedProvider === 'gemini-nano' && <span className="text-[var(--accent)] text-xl leading-none">✓</span>}
                </div>
              </button>

              <button
                onClick={() => setSelectedProvider('anthropic-claude')}
                className={`w-full p-4 rounded-lg border-2 transition ${
                  selectedProvider === 'anthropic-claude'
                    ? 'border-[var(--accent2)] bg-[var(--accent2)]/10 ring-2 ring-[var(--accent2)]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                <div className="text-left flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text)]">Anthropic Claude (Premium)</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      More sophisticated analysis. Requires API key and internet.
                    </p>
                  </div>
                  {selectedProvider === 'anthropic-claude' && <span className="text-[var(--accent2)] text-xl leading-none">✓</span>}
                </div>
              </button>
            </div>

            <button
              onClick={() => setStep(selectedProvider === 'anthropic-claude' ? 'api-key' : 'theme')}
              className="w-full px-4 py-3 bg-[var(--accent)] text-white rounded-lg font-semibold hover:bg-[var(--accent-hover)]"
            >
              Continue with {selectedProvider === 'gemini-nano' ? 'Gemini Nano' : 'Anthropic Claude'}
            </button>
          </div>
        )}

        {step === 'api-key' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-[var(--text)]">Enter Your API Key</h2>
            <p className="text-[var(--text-secondary)]">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] underline"
              >
                console.anthropic.com
              </a>
            </p>

            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep('ai-provider')}
                className="flex-1 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg font-semibold hover:bg-[var(--surface-hover)]"
              >
                Back
              </button>
              <button
                onClick={() => setStep('theme')}
                className="flex-1 px-4 py-3 bg-[var(--accent)] text-white rounded-lg font-semibold hover:bg-[var(--accent-hover)]"
              >
                Continue
              </button>
            </div>
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
                onClick={() => setStep('ai-provider')}
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
              Your {selectedProvider === 'gemini-nano' ? 'Gemini Nano' : 'Anthropic Claude'} filter is ready.
              <br />
              Messages will be checked on-device before they reach you.
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
