interface SwitchProps {
  on: boolean;
  onClick: () => void;
}

export function Switch({ on, onClick }: SwitchProps) {
  return (
    <button onClick={onClick} className={`sw ${on ? 'on' : ''}`}>
      <span className="knob" />
    </button>
  );
}
