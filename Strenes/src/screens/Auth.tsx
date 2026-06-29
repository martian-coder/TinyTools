import { useState } from 'react';
import { useSiftStore } from '../store';
import { setupRecaptcha, signInWithPhone, confirmCode } from '../services/firebase';
import { Phone, Lock, CheckCircle } from 'lucide-react';

export function Auth() {
  const [step, setStep] = useState<'phone' | 'code' | 'profile'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const { setScreen, updateSettings } = useSiftStore();

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const recaptchaVerifier = await setupRecaptcha('recaptcha-container');
      const result = await signInWithPhone(phoneNumber, recaptchaVerifier);
      setConfirmationResult(result);
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await confirmationResult.confirm(code);
      setStep('profile');
    } catch (err: any) {
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Profile setup complete, mark auth as done
      updateSettings({ _onboardingComplete: true });
      setScreen('chats');
    } catch (err: any) {
      setError(err.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[var(--base)] to-[var(--base-dark)] p-4">
      <div className="w-full max-w-md">
        {step === 'phone' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)]/20 mb-4">
                <Phone size={32} className="text-[var(--accent)]" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--text)]">Strenes</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-2">Private message filtering</p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  International format: +1 for US, +44 for UK, etc.
                </p>
              </div>

              <div id="recaptcha-container" />

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? 'Sending code...' : 'Send Code'}
              </button>
            </form>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent2)]/20 mb-4">
                <Lock size={32} className="text-[var(--accent2)]" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text)]">Verify Code</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Enter the code sent to {phoneNumber}
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.slice(0, 6))}
                maxLength={6}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] text-center text-xl tracking-widest focus:outline-none focus:border-[var(--accent2)]"
                required
              />

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-[var(--accent2)] hover:bg-[var(--accent2)]/80 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPhoneNumber('');
                  setStep('phone');
                }}
                className="w-full px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text)]"
              >
                Back
              </button>
            </form>
          </div>
        )}

        {step === 'profile' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/20 mb-4">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text)]">Complete Profile</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">Set your display name</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Start Messaging'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
