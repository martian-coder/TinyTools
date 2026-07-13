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
    primary: { background: 'var(--accent)', color: '#1a1206' },
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
