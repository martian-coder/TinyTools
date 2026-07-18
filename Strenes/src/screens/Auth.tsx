import { useState } from 'react';
import { useSiftStore } from '../store';
import { signInWithEmailOtp, confirmEmailCode, signInWithoutSms, createUserProfile } from '../services/backend';
import type { BackendAuthUser } from '../services/backend';
import { isValidPhone, normalizePhone } from '../utils/phone';
import { Phone, Lock, CheckCircle, Zap, Mail } from 'lucide-react';

/**
 * Registration flow (interim, until an SMS provider is activated):
 *   phone → email → 6-digit code sent TO THE EMAIL → display name.
 * The phone number stays the app's identity (contact search runs on it);
 * the email is the verification channel and is visible in the Supabase
 * Authentication dashboard, so sign-ups are tracked.
 */
export function Auth() {
  const [step, setStep] = useState<'phone' | 'email' | 'code' | 'profile'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [authUser, setAuthUser] = useState<BackendAuthUser | null>(null);

  const { setScreen, setCurrentUser, loadDemoData } = useSiftStore();

  const handleDemoMode = () => {
    localStorage.setItem('__strenes_demo', '1');
    loadDemoData();
    setCurrentUser('demo-user-123', '+1 (555) 123-4567');
    setScreen('commander');
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidPhone(phoneNumber)) {
      setError('Enter a valid phone number with country code, e.g. +91 98765 43210');
      return;
    }
    setStep('email');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!signInWithEmailOtp) {
      await handleQuickStart();
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailOtp(email);
      setNotice('');
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Could not send the code — check the address or use quick sign-up below.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!confirmEmailCode) return;
    setLoading(true);
    try {
      const user = await confirmEmailCode(email, code, normalizePhone(phoneNumber));
      setAuthUser(user);
      setStep('profile');
    } catch {
      setError('Invalid or expired code. Check the email (including spam) and try again.');
    } finally {
      setLoading(false);
    }
  };

  /** Escape hatch when email delivery is unavailable: real session, unverified. */
  const handleQuickStart = async () => {
    if (!signInWithoutSms) {
      setError('Sign-up is unavailable on this build.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await signInWithoutSms(normalizePhone(phoneNumber));
      setAuthUser(user);
      setNotice('Continuing without verification — your number is claimed on first come, first served.');
      setStep('profile');
    } catch (err: any) {
      setError(err.message || 'Quick sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      setError('Session expired — please sign in again.');
      setStep('phone');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Register the profile so other devices can find this user by phone.
      await createUserProfile(authUser.userId, authUser.phone, displayName.trim());
      // Remember the number locally: anonymous sessions don't carry it, and
      // App uses it to self-heal a missing users row on later launches.
      localStorage.setItem('__strenes_phone', authUser.phone);
      setCurrentUser(authUser.userId, authUser.phone);
      setScreen('chats');
    } catch (err: any) {
      setError(err.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  const errorBox = error && (
    <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
      {error}
    </div>
  );

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
              <p className="text-xs text-[var(--text-secondary)] mt-1 opacity-70">by Martian Coders</p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  Include the country code (+91 India, +1 US, +44 UK…). This is
                  how friends will find you.
                </p>
              </div>

              {errorBox}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold disabled:opacity-50"
              >
                Continue
              </button>

              <div className="relative flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-[var(--border)]" />
                <span className="text-xs text-[var(--text-secondary)]">or</span>
                <div className="flex-1 h-px bg-[var(--border)]" />
              </div>

              <button
                type="button"
                onClick={handleDemoMode}
                className="w-full px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text)] rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Zap size={16} className="text-[var(--accent)]" />
                Try Demo — no sign-in needed
              </button>
            </form>
          </div>
        )}

        {step === 'email' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)]/20 mb-4">
                <Mail size={32} className="text-[var(--accent)]" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text)]">Verify by Email</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                We'll email a 6-digit code to confirm it's you.
                <br />Your number {normalizePhone(phoneNumber)} stays your Strenes identity.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                required
                autoFocus
              />

              {errorBox}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? 'Sending code…' : 'Email me the code'}
              </button>

              <button
                type="button"
                onClick={handleQuickStart}
                disabled={loading}
                className="w-full px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
              >
                No email access? Continue without verification
              </button>

              <button
                type="button"
                onClick={() => setStep('phone')}
                className="w-full px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text)]"
              >
                Back
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
              <h2 className="text-2xl font-bold text-[var(--text)]">Enter the Code</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Sent to {email} — check spam if it's not there within a minute.
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] text-center text-xl tracking-widest focus:outline-none focus:border-[var(--accent2)]"
                required
                autoFocus
              />

              {errorBox}

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full px-4 py-3 bg-[var(--accent2)] hover:bg-[var(--accent2)]/80 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <button
                type="button"
                onClick={() => { setCode(''); setStep('email'); }}
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
              {notice && (
                <p className="text-xs text-amber-400/90 mt-3 px-4">{notice}</p>
              )}
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

              {errorBox}

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
