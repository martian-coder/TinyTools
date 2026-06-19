
interface SegmentProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
}

export function Segment<T extends string>({ options, value, onChange }: SegmentProps<T>) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            padding: '5px 10px',
            borderRadius: 7,
            border: 'none',
            background: value === opt.value
              ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
              : 'transparent',
            color: value === opt.value ? '#fff' : 'var(--text-muted)',
            fontWeight: value === opt.value ? 600 : 400,
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
