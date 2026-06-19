import { useSiftStore } from '../../store';
import { THEMES } from '../../theme';

export function AuroraBackground() {
  const theme = useSiftStore(s => s.settings.theme);
  const t = THEMES[theme];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: t.base,
        overflow: 'hidden',
      }}
    >
      <div
        className="aurora-orb aurora-orb-1"
        style={{
          position: 'absolute',
          width: '70vw',
          height: '70vw',
          maxWidth: 500,
          maxHeight: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${t.accent}44 0%, transparent 70%)`,
          filter: 'blur(60px)',
          top: '-15%',
          left: '-10%',
          animation: 'auroraFloat1 22s ease-in-out infinite',
        }}
      />
      <div
        className="aurora-orb aurora-orb-2"
        style={{
          position: 'absolute',
          width: '60vw',
          height: '60vw',
          maxWidth: 420,
          maxHeight: 420,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${t.accent2}44 0%, transparent 70%)`,
          filter: 'blur(70px)',
          top: '30%',
          right: '-15%',
          animation: 'auroraFloat2 28s ease-in-out infinite',
        }}
      />
      <div
        className="aurora-orb aurora-orb-3"
        style={{
          position: 'absolute',
          width: '50vw',
          height: '50vw',
          maxWidth: 360,
          maxHeight: 360,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${t.accent}33 0%, transparent 70%)`,
          filter: 'blur(80px)',
          bottom: '-10%',
          left: '20%',
          animation: 'auroraFloat3 18s ease-in-out infinite',
        }}
      />
    </div>
  );
}
