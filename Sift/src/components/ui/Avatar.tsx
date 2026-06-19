interface AvatarProps {
  name: string;
  grad: string;
  size?: number;
  trusted?: boolean;
}

export function Avatar({ name, grad, size = 44, trusted = false }: AvatarProps) {
  const initial = (name || '?').replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '#';
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        className="shrink-0 grid place-items-center font-semibold text-white"
        style={{
          width: size, height: size,
          borderRadius: 999,
          background: grad,
          boxShadow: '0 6px 16px -8px rgba(0,0,0,.55)',
          display: 'grid', placeItems: 'center',
          color: '#fff', fontWeight: 600,
          fontSize: size * 0.38,
        }}
      >
        {initial}
      </div>
      {trusted && (
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 14, height: 14, borderRadius: '50%',
          background: 'linear-gradient(135deg,#34d399,#06b6d4)',
          border: '2px solid var(--base)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, color: '#fff',
        }}>✓</div>
      )}
    </div>
  );
}
