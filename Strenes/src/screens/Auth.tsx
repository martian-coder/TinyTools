import { useState } from 'react';
import { useSiftStore } from '../store';
import { phoneHasPin, signInWithPin, createUserProfile } from '../services/backend';
import type { BackendAuthUser } from '../services/backend';
import { isValidPhone, normalizePhone } from '../utils/phone';
import { Phone, Lock, CheckCircle, Zap } from 'lucide-react';

/**
 * Registration/sign-in: phone number + a 4-6 digit PIN.
 * First use of a number sets its PIN; later sign-ins (reinstall, new
 * device) enter the same PIN and get the account back with history.
 * PINs are bcrypt-hashed server-side; 5 wrong tries → 15-min lockout.
 */
export function Auth() {
  const [step, setStep] = useState<'phone' | 'pin' | 'profile'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  /** true = number registered (enter PIN); false = new (create); null = unknown/offline. */
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authUser, setAuthUser] = useState<BackendAuthUser | null>(null);

  const { setScreen, setCurrentUser, loadDemoData } = useSiftStore();

  const handleDemoMode = () => {
    localStorage.setItem('__strenes_demo', '1');
    loadDemoData();
    setCurrentUser('demo-user-123', '+1 (555) 123-4567');
    setScreen('commander');
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidPhone(phoneNumber)) {
      setError('Enter a valid phone number with country code, e.g. +91 98765 43210');
      return;
    }
    setLoading(true);
    const known = phoneHasPin ? await phoneHasPin(phoneNumber) : null;
    setLoading(false);
    setHasPin(known);
    setPin('');
    setPinConfirm('');
    setStep('pin');
  };

  const creating = hasPin !== true; // unknown/offline → allow create UX, server decides

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4-6 digits.');
      return;
    }
    if (creating && hasPin === false && pin !== pinConfirm) {
      setError("PINs don't match — type the same PIN twice.");
      return;
    }
    if (!signInWithPin) {
      setError('PIN sign-in is unavailable on this build.');
      return;
    }
    setLoading(true);
    try {
      const user = await signInWithPin(phoneNumber, pin);
      localStorage.setItem('__strenes_phone', user.phone);
      if (user.isNew) {
        setAuthUser(user);
        setStep('profile');
      } else {
        // Returning user: account + history reclaimed server-side; go in.
        setCurrentUser(user.userId, user.phone);
        setScreen('chats');
      }
    } catch (err: any) {
      setError(err.message || 'Sign-in failed');
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

  const pinInput = (value: string, onChange: (v: string) => void, placeholder: string, autoFocus = false) => (
    <input
      type="password"
      inputMode="numeric"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      maxLength={6}
      autoFocus={autoFocus}
      className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] text-center text-xl tracking-[.5em] focus:outline-none focus:border-[var(--accent2)]"
      required
    />
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
                {loading ? 'Checking…' : 'Continue'}
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

        {step === 'pin' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent2)]/20 mb-4">
                <Lock size={32} className="text-[var(--accent2)]" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text)]">
                {hasPin === true ? 'Enter your PIN' : hasPin === false ? 'Create your PIN' : 'Your PIN'}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                {hasPin === true
                  ? `Welcome back — unlock ${normalizePhone(phoneNumber)} with your 4-6 digit PIN.`
                  : hasPin === false
                    ? `Choose a 4-6 digit PIN for ${normalizePhone(phoneNumber)}. It protects your number and signs you back in after a reinstall — remember it.`
                    : `Enter your PIN for ${normalizePhone(phoneNumber)} — or create one if this number is new.`}
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              {pinInput(pin, setPin, '••••', true)}
              {creating && hasPin === false && (
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1 text-center">Confirm PIN</label>
                  {pinInput(pinConfirm, setPinConfirm, '••••')}
                </div>
              )}

              {errorBox}

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full px-4 py-3 bg-[var(--accent2)] hover:bg-[var(--accent2)]/80 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? 'Signing in…' : hasPin === true ? 'Unlock' : 'Continue'}
              </button>

              <button
                type="button"
                onClick={() => { setPin(''); setPinConfirm(''); setStep('phone'); }}
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
