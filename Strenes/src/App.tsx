import { useState, useEffect } from 'react';
import { X, Palette, Check, Lock } from 'lucide-react';
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
import { Groups } from './screens/Groups';
import { onAuthChange, onIncomingMessages, getUserProfile, updateUserStatus, decryptIncoming } from './services/backend';
import { parseCallSignal, handleCallSignal, acceptCall, declineCall } from './services/calls';
import logoUrl from './assets/logo.png';
import { parseReceipt, sendReceipt, sendAutoNotice, isAutoNotice } from './services/receipts';
import { getModerator, routeVerdict } from './moderation';
import { Phone, PhoneOff } from 'lucide-react';
import type { ThemeName } from './types';

/** Header title + tagline per screen — the app shows one header, not one per screen. */
const SCREEN_TITLES: Record<string, { title: string; sub: string }> = {
  commander: { title: 'Commander', sub: 'your AI inbox assistant' },
  chats:     { title: 'Chats',     sub: 'private by design' },
  contacts:  { title: 'Contacts',  sub: 'find people by phone' },
  groups:    { title: 'Groups',    sub: 'E2E encrypted group chats' },
  simulator: { title: 'Test',      sub: 'try the filter on any message' },
  settings:  { title: 'Settings',  sub: 'filters, rules & themes' },
  digest:    { title: 'Digest',    sub: 'your daily summary' },
};

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
  const activeCall     = useSiftStore(s => s.activeCall);
  const contacts       = useSiftStore(s => s.contacts);
  const openConversation = useSiftStore(s => s.openConversation);

  const [showThemes, setShowThemes] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Listen to Firebase auth state
  useEffect(() => {
    // Check for demo mode first ('__strenes_demo' — the old '__demo_mode' flag
    // is intentionally ignored so updated installs boot to the real sign-in).
    const demoMode = new URLSearchParams(window.location.search).get('demo') === '1' ||
                     localStorage.getItem('__strenes_demo') === '1';

    if (demoMode && !currentUserId) {
      // Seed the sample inbox once; later launches keep the user's demo state.
      if (useSiftStore.getState().contacts.length === 0) {
        useSiftStore.getState().loadDemoData();
      }
      setCurrentUser('demo-user-123', '+1 (555) 123-4567');
      setAuthLoading(false);
      localStorage.setItem('__strenes_demo', '1');
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

      // Delivery/read receipts ride the relay too — update ticks and stop.
      const receipt = parseReceipt(msg.text);
      if (receipt) {
        state.applyReceipt(msg.from, receipt);
        return;
      }

      // Call signaling (offer/answer/hangup) rides the same relay but is not
      // a chat message — hand it to the call manager and stop here.
      const signal = parseCallSignal(msg.text);
      if (signal) {
        if (!state.contacts.find(c => c.id === msg.from)) {
          const profile = await getUserProfile(msg.from).catch(() => null);
          state.upsertContact({
            id: msg.from,
            name: profile?.displayName || profile?.phone || 'Unknown',
            phone: profile?.phone,
          });
        }
        await handleCallSignal(currentUserId, msg.from, signal);
        return;
      }

      // Decrypt E2E payload before moderation (moderation runs on plaintext)
      const plainText = await decryptIncoming(msg.from, msg.text);
      const msgForProcessing = { ...msg, text: plainText };

      // Materialize unknown senders as local contacts so the chat renders.
      let contact = state.contacts.find(c => c.id === msgForProcessing.from);
      if (!contact) {
        const profile = await getUserProfile(msgForProcessing.from).catch(() => null);
        state.upsertContact({
          id: msgForProcessing.from,
          name: profile?.displayName || profile?.phone || 'Unknown',
          phone: profile?.phone,
          online: profile?.online,
        });
        contact = useSiftStore.getState().contacts.find(c => c.id === msgForProcessing.from);
      }

      const mod = await getModerator(settings.aiModeration.anthropicKey || undefined);
      const verdict = await mod.classify(msgForProcessing.text, { sensitivity: settings.civility.sensitivity });
      const trusted = !!contact?.trusted || settings.trustedIds.includes(msgForProcessing.from);
      const circleAllowed = contact?.circle === 'family' || contact?.circle === 'vip';
      const route = routeVerdict(verdict, settings, trusted, contact?.isEmergency, circleAllowed);
      const finalRoute = await state.checkAndReceiveMessage(
        msgForProcessing.from, msgForProcessing.text, route, verdict,
        settings.aiModeration.anthropicKey || settings.aiReplies.anthropicKey,
        { relayId: msgForProcessing.id },
      );

      // Honest status back to the sender: delivered, or a short reason when
      // the filter intervened ("held — spam"). Never the recipient's rules.
      const kind = finalRoute.status === 'delivered' ? 'delivered'
        : finalRoute.status === 'held' ? 'held' : 'filtered';
      const reason = kind === 'delivered' ? undefined
        : (verdict.category !== 'clean' ? verdict.category : 'review');
      sendReceipt(currentUserId, msgForProcessing.from, { kind, ids: [msgForProcessing.id], reason });

      // Blocked with notify-sender on: tell them in-chat that this kind of
      // message can't be received. Auto-notices are never auto-replied to.
      if (finalRoute.autoReply && kind !== 'delivered' && !isAutoNotice(msgForProcessing.text)) {
        sendAutoNotice(currentUserId, msgForProcessing.from);
      }
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

        {/* App header — Strenes brand on the left, current screen on the right */}
        {activeScreen !== 'conversation' && (
          <div className="px-3 pb-1.5 flex items-center gap-2" style={{ paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))' }}>
            <img
              src={logoUrl}
              alt="Strenes"
              style={{ width: 26, height: 26, borderRadius: 8, display: 'block' }}
            />
            <div>
              <div className="font-bold text-main leading-tight" style={{ fontSize: 13 }}>Strenes</div>
              <div className="text-[9px] dim leading-tight">built by Amit N</div>
            </div>
            <div className="ml-auto text-right">
              <div className="font-semibold text-main leading-tight" style={{ fontSize: 12 }}>
                {SCREEN_TITLES[activeScreen]?.title ?? ''}
              </div>
              <div className="text-[9px] dim leading-tight">
                {SCREEN_TITLES[activeScreen]?.sub ?? ''}
              </div>
            </div>
          </div>
        )}

        {/* Screen */}
        <div key={activeScreen} className="flex-1 flex flex-col overflow-hidden screen">
          {activeScreen === 'commander'    && <Commander />}
          {activeScreen === 'digest'       && <Digest />}
          {activeScreen === 'chats'       && <ChatList />}
          {activeScreen === 'conversation' && <Conversation />}
          {activeScreen === 'settings'    && <Settings />}
          {activeScreen === 'simulator'   && <Simulator />}
          {activeScreen === 'contacts'    && <Contacts />}
          {activeScreen === 'groups'      && <Groups />}
        </div>

        {/* Bottom nav */}
        {!isConversation && <BottomNav />}

        {/* Incoming call — global overlay so a call reaches you on any screen */}
        {activeCall?.status === 'incoming' && currentUserId && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(5,8,20,0.88)', backdropFilter: 'blur(14px)' }}>
            <div
              className="grid place-items-center mb-4"
              style={{
                width: 86, height: 86, borderRadius: 999,
                background: 'linear-gradient(135deg,var(--accent),var(--accent2))',
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
            >
              <Phone size={36} color="#fff" />
            </div>
            <div className="text-xl font-bold text-main mb-1">
              {contacts.find(c => c.id === activeCall.peerId)?.name ?? 'Unknown caller'}
            </div>
            <div className="text-sm dim mb-10">Incoming voice call…</div>
            <div className="flex items-center gap-14">
              <button
                onClick={() => declineCall(currentUserId)}
                className="flex flex-col items-center gap-2"
              >
                <span className="grid place-items-center" style={{ width: 62, height: 62, borderRadius: 999, background: '#e11d48' }}>
                  <PhoneOff size={26} color="#fff" />
                </span>
                <span className="text-[11px] dim">Decline</span>
              </button>
              <button
                onClick={() => {
                  acceptCall(currentUserId);
                  openConversation(activeCall.peerId);
                }}
                className="flex flex-col items-center gap-2"
              >
                <span className="grid place-items-center" style={{ width: 62, height: 62, borderRadius: 999, background: '#10b981' }}>
                  <Phone size={26} color="#fff" />
                </span>
                <span className="text-[11px] dim">Accept</span>
              </button>
            </div>
          </div>
        )}

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
