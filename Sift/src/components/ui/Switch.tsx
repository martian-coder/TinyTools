
interface SwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
      {label && <span style={{ color: 'var(--text)', fontSize: 14 }}>{label}</span>}
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked
            ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
            : 'var(--surface-strong)',
          border: '1px solid var(--border)',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />
      </div>
    </label>
  );
}
