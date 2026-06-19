interface SegmentOption { v: string; l: string; }

interface SegmentProps {
  value: string;
  options: SegmentOption[];
  onChange: (v: string) => void;
}

export function Segment({ value, options, onChange }: SegmentProps) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} className={value === o.v ? 'on' : ''}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
