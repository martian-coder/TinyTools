import { MessageSquare, Settings as SettingsIcon, Bot, Users, UsersRound } from 'lucide-react';
import { useSiftStore } from '../../store';

type Tab = 'commander' | 'chats' | 'groups' | 'contacts' | 'settings';

const TABS: { id: Tab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'commander', label: 'Commander', Icon: Bot           },
  { id: 'chats',     label: 'Chats',     Icon: MessageSquare },
  { id: 'groups',    label: 'Groups',    Icon: UsersRound    },
  { id: 'contacts',  label: 'Contacts',  Icon: Users         },
  { id: 'settings',  label: 'Settings',  Icon: SettingsIcon  },
];

export function BottomNav() {
  const activeScreen = useSiftStore(s => s.activeScreen);
  const setScreen    = useSiftStore(s => s.setScreen);
  const reviewCount  = useSiftStore(s => s.messages.filter(m => m.status === 'held').length);
  // Delivered messages the user hasn't opened that chat to see yet.
  const unreadCount  = useSiftStore(s => s.messages.filter(m => m.dir === 'in' && m.status === 'delivered' && !m.readReceiptSent).length);
  const chatsBadge   = reviewCount + unreadCount;

  const activeTab: Tab =
    activeScreen === 'conversation' ? 'chats' :
    activeScreen === 'settings'     ? 'settings' :
    activeScreen === 'contacts'     ? 'contacts' :
    activeScreen === 'groups'       ? 'groups' :
    activeScreen === 'commander'    ? 'commander' : 'chats';

  return (
    <div className="nav-wrap">
      <div className="nav">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setScreen(id)} className={`nav-item ${active ? 'nav-on' : ''}`} style={{ position: 'relative' }} title={label}>
              <Icon size={19} />
              {id === 'chats' && chatsBadge > 0 && (
                <span className="rev-dot" style={{ position: 'absolute', top: 4, right: 8 }}>
                  {chatsBadge > 99 ? '99+' : chatsBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
