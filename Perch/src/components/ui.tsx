import type { ReactNode } from 'react';

export function Glass({ children, className = '', onClick }: {
  children: ReactNode; className?: string; onClick?: () => void;
}) {
  return (
    <div className={`glass ${onClick ? 'glass-hover cursor-pointer' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, kind = 'primary', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean; className?: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    // Gradient sheen + colored glow + inset top highlight — a flat solid
    // fill reads flat; this is what actually makes a filled button look
    // like glossy iOS "glass" chrome rather than a plain color swatch.
    primary: {
      background: 'linear-gradient(180deg, rgba(255,255,255,.3), rgba(255,255,255,0) 45%), var(--accent)',
      color: 'var(--accent-contrast)',
      boxShadow: '0 10px 24px -8px var(--accent), inset 0 1px 0 rgba(255,255,255,.4)',
    },
    ghost: { background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--text)' },
    danger: { background: 'rgba(251,113,133,.15)', border: '1px solid rgba(251,113,133,.4)', color: 'var(--danger)' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-5 py-3.5 font-semibold text-[15px] transition active:scale-[.98] disabled:opacity-40 ${className}`}
      style={styles[kind]}
    >
      {children}
    </button>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-xs font-medium"
      style={{ background: 'var(--glass2)', border: '1px solid var(--line)', color: 'var(--text)' }}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-1 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--dim)' }}>
      {children}
    </div>
  );
}
