import { useState, useEffect } from 'react';
import { X, Palette, Check, Lock, Shield } from 'lucide-react';
import { useSiftStore } from './store';
import { THEMES } from './theme';
import { BottomNav } from './components/ui/BottomNav';
import { ChatList } from './screens/ChatList';
import { Conversation } from './screens/Conversation';
import { Settings } from './screens/Settings';
import { Simulator } from './screens/Simulator';
import { Digest } from './screens/Digest';
import { Commander } from './screens/Commander';
import { Onboarding } from './screens/Onboarding';
import { Auth } from './screens/Auth';
import { Contacts } from './screens/Contacts';
import { onAuthChange, onIncomingMessages, getUserProfile, updateUserStatus } from './services/backend';
import { getModerator, routeVerdict } from './moderation';
import type { ThemeName } from './types';

export default function App() {
  const activeScreen   = useSiftStore(s => s.activeScreen);
  const theme          = useSiftStore(s => s.settings.theme);
  const updateSettings = useSiftStore(s => s.updateSettings);
  const pendingAsk     = useSiftStore(s => s.pendingAsk);
  const resolvePendingAsk = useSiftStore(s => s.resolvePendingAsk);
  const banner         = useSiftStore(s => s.banner);
  const setBanner      = useSiftStore(s => s.setBanner);
  const flushQueue     = useSiftStore(s => s.flushQueue);
  const onboardingComplete = useSiftStore(s => s.settings._onboardingComplete);
  const currentUserId  = useSiftStore(s => s.currentUserId);
  const setCurrentUser = useSiftStore(s => s.setCurrentUser);

  const [showThemes, setShowThemes] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Listen to Firebase auth state
  useEffect(() => {
    // Check for demo mode first
    const demoMode = new URLSearchParams(window.location.search).get('demo') === '1' ||
                     localStorage.getItem('__demo_mode') === '1';

    if (demoMode && !currentUserId) {
      // Use mock user for demo/testing
      setCurrentUser('demo-user-123', '+1 (555) 123-4567');
      setAuthLoading(false);
      localStorage.setItem('__demo_mode', '1');
      return;
    }

    const unsubscribe = onAuthChange((user) => {
      if (user) {
        setCurrentUser(user.uid, user.phoneNumber || '');
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [setCurrentUser, currentUserId]);

  // Global incoming-message pipeline: every message addressed to this user —
  // no matter which screen is open — is classified on-device, routed through
  // routeVerdict(), checked against dynamic rules, and stored locally. This is
  // the single place backend messages enter the app.
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = onIncomingMessages(currentUserId, async (msg) => {
      const state = useSiftStore.getState();
      const { settings } = state;

      // Materialize unknown senders as local contacts so the chat renders.
      let contact = state.contacts.find(c => c.id === msg.from);
      if (!contact) {
        const profile = await getUserProfile(msg.from).catch(() => null);
        state.upsertContact({
          id: msg.from,
          name: profile?.displayName || profile?.phone || 'Unknown',
          phone: profile?.phone,
          online: profile?.online,
        });
        contact = useSiftStore.getState().contacts.find(c => c.id === msg.from);
      }

      const mod = await getModerator(settings.aiModeration.anthropicKey || undefined);
      const verdict = await mod.classify(msg.text, { sensitivity: settings.civility.sensitivity });
      const trusted = !!contact?.trusted || settings.trustedIds.includes(msg.from);
      const route = routeVerdict(verdict, settings, trusted, contact?.isEmergency);
      await state.checkAndReceiveMessage(
        msg.from, msg.text, route, verdict,
        settings.aiModeration.anthropicKey || settings.aiReplies.anthropicKey,
      );
    });

    return unsubscribe;
  }, [currentUserId]);

  // Presence: mark online while the app is open, offline on the way out.
  useEffect(() => {
    if (!currentUserId) return;
    updateUserStatus(currentUserId, true).catch(() => {});
    const markOffline = () => { updateUserStatus(currentUserId, false).catch(() => {}); };
    window.addEventListener('beforeunload', markOffline);
    return () => {
      window.removeEventListener('beforeunload', markOffline);
      markOffline();
    };
  }, [currentUserId]);

  // Flush queued messages as soon as connectivity returns
  useEffect(() => {
    const handler = () => {
      flushQueue();
      setBanner('Back online — queued messages sent via internet.');
      setTimeout(() => setBanner(null), 3000);
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [flushQueue, setBanner]);

  const themeVars = THEMES[theme].vars;
  const isConversation = activeScreen === 'conversation';

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[var(--base)] to-[var(--base-dark)]">
        <div className="text-center">
          <div className="text-2xl font-bold text-[var(--text)]">Strenes</div>
          <div className="text-sm text-[var(--text-secondary)] mt-2">Loading...</div>
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!currentUserId) {
    return <Auth />;
  }

  // Show onboarding if setup incomplete
  if (!onboardingComplete) {
    return <Onboarding />;
  }

  return (
    <div
      className="app-bg"
      style={themeVars as React.CSSProperties}
    >
      <div className="phone">

        {/* Banner */}
        {banner && (
          <div
            className="absolute top-3 left-3 right-3 z-30 glass2 text-main text-xs px-3 py-2.5 flex items-center justify-between slide-up"
            style={{ borderRadius: 14 }}
          >
            <span>{banner}</span>
            <button onClick={() => setBanner(null)}><X size={14} /></button>
          </div>
        )}

        {/* Branded header */}
        {activeScreen !== 'conversation' && (
          <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-2">
            <div
              className="grid place-items-center"
              style={{
                width: 26, height: 26, borderRadius: 8,
                background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
              }}
            >
              <Shield size={13} color="#fff" />
            </div>
            <div>
              <div className="font-bold text-main leading-tight" style={{ fontSize: 13 }}>Strenes</div>
              <div className="text-[9px] dim leading-tight">Private messaging</div>
            </div>
          </div>
        )}

        {/* Screen */}
        <div key={activeScreen} className="flex-1 flex flex-col overflow-hidden screen">
          {activeScreen === 'commander'    && <Commander />}
          {activeScreen === 'digest'       && <Digest />}
          {activeScreen === 'chats'       && <ChatList    onShowThemes={() => setShowThemes(true)} />}
          {activeScreen === 'conversation' && <Conversation />}
          {activeScreen === 'settings'    && <Settings    onShowThemes={() => setShowThemes(true)} />}
          {activeScreen === 'simulator'   && <Simulator />}
          {activeScreen === 'contacts'    && <Contacts />}
        </div>

        {/* Bottom nav */}
        {!isConversation && <BottomNav />}

        {/* Theme bottom sheet */}
        {showThemes && (
          <div
            className="absolute inset-0 z-40 flex items-end"
            onClick={() => setShowThemes(false)}
          >
            <div className="sheet-bg" />
            <div
              className="glass2 relative w-full p-4 slide-up"
              style={{ borderTopLeftRadius: 26, borderTopRightRadius: 26 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 font-semibold text-main mb-3">
                <Palette size={16} /> Theme
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][]).map(([k, t]) => (
                  <button
                    key={k}
                    onClick={() => { updateSettings({ theme: k }); setShowThemes(false); }}
                    className={`th-card ${theme === k ? 'th-on' : ''}`}
                  >
                    <span className="th-swatch" style={{ background: t.swatch }} />
                    <span className="text-sm font-medium text-main">{t.label}</span>
                    {theme === k && <Check size={14} className="accent-t" style={{ marginLeft: 'auto' }} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* askPerMessage modal */}
        {pendingAsk && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)' }}
          >
            <div className="glass2 w-full p-6 pop" style={{ borderRadius: 24, maxWidth: 340 }}>
              <div className="grid place-items-center mb-4"
                style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', boxShadow: '0 8px 24px -8px var(--accent)', margin: '0 auto 16px' }}>
                <Lock size={22} color="#fff" />
              </div>
              <h3 className="font-bold text-main text-center text-base mb-2">Message Filtered</h3>
              <p className="text-sm dim text-center mb-4 leading-relaxed">
                Your civility filter held a message. Do you want to read it?
              </p>
              <div
                className="text-sm text-main p-3 mb-4 blur-sm select-none"
                style={{ background: 'var(--in)', borderRadius: 12 }}
              >
                {pendingAsk.text}
              </div>
              <div className="flex gap-2">
                <button onClick={() => resolvePendingAsk(true)}  className="act act-ok flex-1">View it</button>
                <button onClick={() => resolvePendingAsk(false)} className="act act-no flex-1">Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
