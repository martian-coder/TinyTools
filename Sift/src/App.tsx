import { useEffect } from 'react';
import { useSiftStore } from './store';
import { THEMES, applyTheme } from './theme';
import { AuroraBackground } from './components/ui/AuroraBackground';
import { BottomNav } from './components/ui/BottomNav';
import { Glass } from './components/ui/Glass';
import { ChatList } from './screens/ChatList';
import { Conversation } from './screens/Conversation';
import { Settings } from './screens/Settings';
import { Simulator } from './screens/Simulator';

export default function App() {
  const activeScreen = useSiftStore(s => s.activeScreen);
  const theme = useSiftStore(s => s.settings.theme);
  const pendingAsk = useSiftStore(s => s.pendingAsk);
  const resolvePendingAsk = useSiftStore(s => s.resolvePendingAsk);

  // Apply theme to CSS variables whenever theme changes
  useEffect(() => {
    applyTheme(THEMES[theme]);
  }, [theme]);

  const showNav = activeScreen !== 'conversation';

  return (
    // Full-page outer container — centers phone frame on desktop
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: THEMES[theme].isLight ? '#d0d4e8' : '#050810',
      }}
    >
      {/* Phone frame */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 430,
          height: '100%',
          maxHeight: '100dvh',
          overflow: 'hidden',
        }}
      >
        {/* Animated aurora background */}
        <AuroraBackground />

        {/* Screen content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: showNav ? 80 : 0,
            overflow: 'hidden',
          }}
        >
          {activeScreen === 'chats' && <ChatList />}
          {activeScreen === 'conversation' && <Conversation />}
          {activeScreen === 'settings' && <Settings />}
          {activeScreen === 'simulator' && <Simulator />}
        </div>

        {/* Bottom nav */}
        {showNav && <BottomNav />}

        {/* askPerMessage modal */}
        {pendingAsk && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 200,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <Glass strong style={{ padding: 24, maxWidth: 340, width: '100%', animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>🛡️</div>
              <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
                Message Filtered
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', margin: '0 0 16px', lineHeight: 1.5 }}>
                A message was blocked by your civility filter. Do you want to view it?
              </p>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 16,
                  filter: 'blur(4px)',
                  userSelect: 'none',
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              >
                {pendingAsk.text}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => resolvePendingAsk(true)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 10,
                    border: '1px solid rgba(16,185,129,0.4)',
                    background: 'rgba(16,185,129,0.15)',
                    color: '#34d399',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  View it
                </button>
                <button
                  onClick={() => resolvePendingAsk(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 10,
                    border: '1px solid rgba(244,63,94,0.4)',
                    background: 'rgba(244,63,94,0.15)',
                    color: '#fb7185',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Discard
                </button>
              </div>
            </Glass>
          </div>
        )}
      </div>
    </div>
  );
}
