import { usePerch } from './store';
import { Welcome } from './screens/Welcome';
import { ParentHome } from './screens/ParentHome';
import { Chat } from './screens/Chat';
import { Shield } from './screens/Shield';
import { Settings } from './screens/Settings';
import { KidSetup } from './screens/KidSetup';
import { KidHome } from './screens/KidHome';
import { BottomNav } from './components/BottomNav';

export default function App() {
  const { role, linked, pairingId, tab, demo } = usePerch();

  let content;
  if (role === 'unset') {
    content = <Welcome />;
  } else if (role === 'kid') {
    content = (linked || pairingId) && pairingId ? <KidHome /> : <KidSetup />;
  } else {
    // parent (real or demo): tabbed shell
    content = (
      <>
        {demo && (
          <div
            className="mx-4 mt-3 rounded-2xl px-4 py-2 text-center text-[11.5px] font-semibold"
            style={{ background: 'rgba(245,185,66,.12)', border: '1px solid rgba(245,185,66,.35)', color: 'var(--accent)' }}
          >
            Demo mode — sample data. Reset from Settings.
          </div>
        )}
        {tab === 'home' && <ParentHome />}
        {tab === 'chat' && <Chat />}
        {tab === 'shield' && <Shield />}
        {tab === 'settings' && <Settings />}
        <BottomNav />
      </>
    );
  }

  return (
    <div className="app-bg">
      <div className="phone">{content}</div>
    </div>
  );
}
