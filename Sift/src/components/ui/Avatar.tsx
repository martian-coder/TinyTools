
interface AvatarProps {
  name: string;
  grad: string;
  size?: number;
  trusted?: boolean;
}

export function Avatar({ name, grad, size = 44, trusted = false }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: grad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: size * 0.36,
          letterSpacing: '0.02em',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}
      >
        {initials}
      </div>
      {trusted && (
        <div
          title="Trusted contact"
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#34d399,#06b6d4)',
            border: '2px solid var(--base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 7,
          }}
        >
          ✓
        </div>
      )}
    </div>
  );
}
