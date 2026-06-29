import { MessageSquare, FlaskConical, Settings as SettingsIcon, Bot, Users } from 'lucide-react';
import { useSiftStore } from '../../store';

type Tab = 'commander' | 'chats' | 'contacts' | 'simulator' | 'settings';

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'commander', label: 'Commander', Icon: Bot           },
  { id: 'chats',     label: 'Chats',     Icon: MessageSquare },
  { id: 'contacts',  label: 'Contacts',  Icon: Users         },
  { id: 'simulator', label: 'Test',      Icon: FlaskConical  },
  { id: 'settings',  label: 'Settings',  Icon: SettingsIcon  },
];

export function BottomNav() {
  const activeScreen = useSiftStore(s => s.activeScreen);
  const setScreen    = useSiftStore(s => s.setScreen);
  const reviewCount  = useSiftStore(s => s.messages.filter(m => m.status === 'held').length);

  const activeTab: Tab =
    activeScreen === 'conversation' ? 'chats' :
    activeScreen === 'settings'     ? 'settings' :
    activeScreen === 'contacts'     ? 'contacts' :
    activeScreen === 'simulator'    ? 'simulator' :
    activeScreen === 'commander'    ? 'commander' : 'chats';

  return (
    <div className="nav-wrap">
      <div className="nav">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setScreen(id)} className={`nav-item ${active ? 'nav-on' : ''}`} style={{ position: 'relative' }}>
              <Icon size={17} />
              <span style={{ fontSize: 9 }}>{label}</span>
              {id === 'chats' && reviewCount > 0 && (
                <span className="rev-dot" style={{ position: 'absolute', top: 4, right: 8 }}>
                  {reviewCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
