import { Home, MessageCircle, ShieldCheck, Settings } from 'lucide-react';
import type { ParentTab } from '../types';
import { usePerch } from '../store';

const TABS: Array<{ id: ParentTab; label: string; Icon: typeof Home }> = [
  { id: 'home', label: 'Nest', Icon: Home },
  { id: 'chat', label: 'Ask Perch', Icon: MessageCircle },
  { id: 'shield', label: 'Shield', Icon: ShieldCheck },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function BottomNav() {
  const tab = usePerch(s => s.tab);
  const setTab = usePerch(s => s.setTab);
  return (
    <div className="px-4 pb-4 pt-2">
      <div className="glass flex items-center justify-around rounded-3xl px-2 py-2">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex min-w-[64px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 transition"
              style={active ? { background: 'var(--glass2)', color: 'var(--accent)' } : { color: 'var(--dim)' }}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
