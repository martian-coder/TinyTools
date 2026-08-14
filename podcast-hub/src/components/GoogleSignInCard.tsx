import React, { useState, useEffect } from 'react';
import {
  X,
  LogOut,
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check,
  ChevronRight,
  Youtube,
} from 'lucide-react';
import { startGoogleSignIn, logoutFirebase } from '../lib/auth';
import { executeUniversalSignIn, promptGoogleGisLogin } from '../lib/clientAuth';

interface GoogleSignInCardProps {
  onClose?: () => void;
  onSuccess?: (profile: { name: string; handle: string; avatar: string }) => void;
  isModal?: boolean;
}

export interface ConnectedProfile {
  name: string;
  handle: string;
  avatar: string;
  email?: string;
  accessToken?: string;
}

/* ─── Official Google G SVG ─────────────────────────────────────── */
const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

/* ─── Tiny step component ────────────────────────────────────────── */
const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3 items-start text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">
    <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
      {n}
    </span>
    <span>{children}</span>
  </li>
);

const CopyableCode = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 bg-slate-900 dark:bg-slate-950 text-emerald-400 font-mono text-[11px] px-2.5 py-1 rounded-lg border border-slate-700 hover:border-emerald-600 cursor-pointer transition-colors group"
      title="Copy"
    >
      <span>{value}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400" />
      ) : (
        <Copy className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
      )}
    </button>
  );
};

/* ─── Main Component ─────────────────────────────────────────────── */
export const GoogleSignInCard: React.FC<GoogleSignInCardProps> = ({
  onClose,
  onSuccess,
  isModal = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [handleInput, setHandleInput] = useState('');

  const [currentProfile, setCurrentProfile] = useState<ConnectedProfile | null>(() => {
    try {
      const saved = localStorage.getItem('user_yt_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Listen for profile updates from the redirect handler in App.tsx
  useEffect(() => {
    const sync = () => {
      try {
        const saved = localStorage.getItem('user_yt_profile');
        if (saved) {
          const prof = JSON.parse(saved);
          setCurrentProfile(prof);
          if (onSuccess) onSuccess(prof);
        } else {
          setCurrentProfile(null);
        }
      } catch {}
    };
    window.addEventListener('yt_profile_updated', sync);
    return () => window.removeEventListener('yt_profile_updated', sync);
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    
    // 1. Try server-side OAuth redirect (for localhost or backend deployment)
    try {
      await startGoogleSignIn();
      return;
    } catch (err: any) {
      console.info('Backend OAuth not available on static host, initializing Google Identity SDK...');
    }

    // 2. Client-side Google Identity Services (GIS) OAuth
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '285175014537-nn318q5n4gqd1fglqgkgsapuhd0s0cvn.apps.googleusercontent.com';
    try {
      const gisProfile = await promptGoogleGisLogin(clientId);
      setCurrentProfile(gisProfile);
      if (onSuccess) onSuccess(gisProfile);
      setIsLoading(false);
    } catch (gisErr: any) {
      console.error('Google Sign-In error:', gisErr);
      setError('Google Sign-In failed or was closed. Please select your Google account to sign in.');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logoutFirebase();
    setCurrentProfile(null);
  };

  /* ── Connected State ── */
  const connectedUI = currentProfile && (
    <div className="space-y-4">
      {/* Profile row */}
      <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
        <div className="relative shrink-0">
          <img
            src={currentProfile.avatar}
            alt={currentProfile.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-teal-500 shadow-2xs"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentProfile.name)}&background=11A888&color=fff&size=200&bold=true`;
            }}
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-teal-500 border-2 border-white flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-sm text-slate-800 truncate">{currentProfile.name}</div>
          {currentProfile.email && (
            <div className="text-xs text-slate-500 truncate">{currentProfile.email}</div>
          )}
          <div className="text-xs text-teal-600 font-medium mt-0.5 truncate">{currentProfile.handle}</div>
        </div>
      </div>

      {/* Google branding row */}
      <div className="flex items-center gap-2 px-1">
        <GoogleIcon size={14} />
        <span className="text-xs text-slate-500">Connected Account</span>
        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 ml-auto" />
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 font-medium text-xs transition-colors cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        Sign Out
      </button>
    </div>
  );

  /* ── Sign-In Form ── */
  const signInUI = !currentProfile && (
    <div className="space-y-4">
      {/* Pure 1-Click Direct Google Sign In Button */}
      <button
        id="google-signin-btn"
        onClick={() => handleGoogleSignIn()}
        disabled={isLoading}
        className="w-full flex items-center gap-3 bg-[#11A888] hover:bg-[#0e9478] text-white font-semibold py-3.5 px-4 rounded-xl shadow-md transition-all cursor-pointer text-sm active:scale-[0.99] group disabled:opacity-60"
      >
        <span className="shrink-0 bg-white p-1.5 rounded-full shadow-xs">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-800" /> : <GoogleIcon size={18} />}
        </span>
        <span className="flex-1 text-left text-white font-bold text-sm">
          {isLoading ? 'Connecting to Google…' : 'Sign in with Google'}
        </span>
        {!isLoading && (
          <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform ml-auto shrink-0" />
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl text-center">
          {error}
        </div>
      )}
    </div>
  );

  const cardContent = (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl relative text-slate-800">

      {/* Close */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Header */}
      <div className="text-center mb-6 space-y-2">
        {/* Logo cluster */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center">
            <GoogleIcon size={20} />
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
            <Youtube className="w-5 h-5 text-teal-600 fill-teal-600" />
          </div>
        </div>

        {currentProfile ? (
          <>
            <h2 className="text-base font-semibold text-slate-800 tracking-tight">Account Connected</h2>
            <p className="text-xs text-slate-500">
              Your Google &amp; YouTube account is linked.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-slate-800 tracking-tight">Sign in with Google</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Sync your YouTube channel profile, subscriptions feed, and liked videos.
            </p>
          </>
        )}
      </div>

      {currentProfile ? connectedUI : signInUI}

      {/* Footer */}
      <p className="text-[11px] text-center text-slate-400 mt-5">
        🔒 Powered by Google Identity &amp; Local Persistence
      </p>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 pt-10 sm:pt-16 overflow-y-auto">
        {cardContent}
      </div>
    );
  }
  return <div className="flex justify-center my-6 w-full">{cardContent}</div>;
};

/* ─── YouTube Handle Fallback (secondary option) ───────────────── */
function YTHandleFallback({
  onSuccess,
}: {
  onSuccess: (prof: ConnectedProfile) => void;
}) {
  const [handle, setHandle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');

  const connect = async (h: string) => {
    const raw = h.trim();
    if (!raw) return;
    const cleanHandle = raw.startsWith('@') ? raw : `@${raw}`;
    setIsLoading(true);
    setStatus('Looking up channel…');

    try {
      const res = await fetch(`/api/youtube/channel-by-handle?handle=${encodeURIComponent(cleanHandle)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.channel?.name) {
          const prof: ConnectedProfile = {
            name: data.channel.name,
            handle: data.channel.handle || cleanHandle,
            avatar:
              data.channel.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(data.channel.name)}&background=ef4444&color=fff&size=200&bold=true`,
          };
          localStorage.setItem('user_yt_profile', JSON.stringify(prof));
          window.dispatchEvent(new Event('yt_profile_updated'));
          onSuccess(prof);
          return;
        }
      }
    } catch {}

    // Fallback: use handle as name
    const name = cleanHandle.replace('@', '');
    const prof: ConnectedProfile = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      handle: cleanHandle,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ef4444&color=fff&size=200&bold=true`,
    };
    localStorage.setItem('user_yt_profile', JSON.stringify(prof));
    window.dispatchEvent(new Event('yt_profile_updated'));
    onSuccess(prof);
    setIsLoading(false);
    setStatus('');
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 text-center">
        Connect by YouTube channel handle
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          connect(handle);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm pointer-events-none select-none">
            @
          </span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/^@+/, ''))}
            placeholder="your-channel"
            disabled={isLoading}
            className="w-full pl-7 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !handle.trim()}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#3ea6ff] hover:bg-[#2697ff] disabled:bg-[#3ea6ff]/40 text-black font-extrabold text-sm transition-colors cursor-pointer disabled:cursor-not-allowed shadow-md shadow-[#3ea6ff]/20"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : 'Connect'}
        </button>
      </form>
      {status && <p className="text-[11px] text-slate-400 text-center">{status}</p>}
    </div>
  );
}
