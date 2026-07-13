import { usePerch } from '../store';
import { demoEvents, demoGreeting } from '../seed';
import { OwlLogo } from '../components/OwlLogo';
import { Btn } from '../components/ui';

export function Welcome() {
  const setRole = usePerch(s => s.setRole);
  const startDemo = usePerch(s => s.startDemo);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="rise"><OwlLogo size={120} /></div>
      <h1 className="rise text-4xl font-extrabold tracking-tight" style={{ color: 'var(--accent)' }}>Perch</h1>
      <p className="rise max-w-[300px] text-[15px] leading-relaxed" style={{ color: 'var(--dim)' }}>
        The AI guardian that watches over your kid's phone —
        <b style={{ color: 'var(--text)' }}> without reading over their shoulder.</b>
      </p>

      <div className="rise mt-6 flex w-full max-w-[320px] flex-col gap-3">
        <Btn onClick={() => setRole('parent')}>I'm a parent — this is my phone</Btn>
        <Btn kind="ghost" onClick={() => setRole('kid')}>Protect this phone (my kid's)</Btn>
        <Btn kind="ghost" onClick={() => startDemo(demoEvents(), demoGreeting())}>
          👀 Try the demo
        </Btn>
      </div>

      <p className="mt-8 max-w-[300px] text-[11.5px] leading-relaxed" style={{ color: 'var(--dim)' }}>
        Everything is scanned on the phone itself. Message content never
        leaves the device — only a flag with the reason ever reaches you.
      </p>
      <p className="text-[10px]" style={{ color: 'var(--dim)' }}>build {__BUILD_STAMP__}</p>
    </div>
  );
}
