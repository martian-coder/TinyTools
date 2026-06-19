import { useSiftStore } from '../../store';
import { selectUnreadCount } from '../../store';

type Tab = 'chats' | 'simulator' | 'settings';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'chats',     icon: '💬', label: 'Chats'    },
  { id: 'simulator', icon: '🧪', label: 'Test'     },
  { id: 'settings',  icon: '⚙️', label: 'Settings' },
];

export function BottomNav() {
  const activeScreen = useSiftStore(s => s.activeScreen);
  const setScreen = useSiftStore(s => s.setScreen);
  const reviewCount = useSiftStore(s => selectUnreadCount(s, 'review'));

  const activeTab: Tab =
    activeScreen === 'conversation' ? 'chats' :
    activeScreen === 'settings' ? 'settings' :
    activeScreen === 'simulator' ? 'simulator' : 'chats';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        padding: '8px 16px 20px',
        gap: 4,
        zIndex: 100,
      }}
    >
      {TABS.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setScreen(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 4px',
              borderRadius: 14,
              border: 'none',
              background: active
                ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                : 'transparent',
              color: active ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
            {tab.id === 'chats' && reviewCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: '50%',
                  marginRight: -20,
                  background: '#fb7185',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '1px 5px',
                  minWidth: 16,
                  textAlign: 'center',
                }}
              >
                {reviewCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
