/** Perch's owl — big amber eyes on a night-forest body, sitting on a branch. */
export function OwlLogo({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-label="Perch owl">
      {/* branch */}
      <path d="M8 82 Q48 74 88 82" stroke="#6b4f2a" strokeWidth="5" strokeLinecap="round" />
      {/* ear tufts */}
      <path d="M28 22 L34 8 L42 20 Z" fill="#22332a" />
      <path d="M68 22 L62 8 L54 20 Z" fill="#22332a" />
      {/* body */}
      <path
        d="M48 12 C29 12 20 27 20 44 L20 62 C20 72 28 79 38 79 L58 79 C68 79 76 72 76 62 L76 44 C76 27 67 12 48 12 Z"
        fill="#22332a" stroke="#3a5243" strokeWidth="2"
      />
      {/* belly */}
      <ellipse cx="48" cy="62" rx="16" ry="14" fill="#31473a" />
      <path d="M40 56 q8 5 16 0 M38 64 q10 6 20 0" stroke="#22332a" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* eyes */}
      <g className="owl-eye">
        <circle cx="36" cy="38" r="11" fill="#f5b942" />
        <circle cx="60" cy="38" r="11" fill="#f5b942" />
        <circle cx="36" cy="38" r="5" fill="#141b16" />
        <circle cx="60" cy="38" r="5" fill="#141b16" />
        <circle cx="38" cy="36" r="1.8" fill="#fff8e7" />
        <circle cx="62" cy="36" r="1.8" fill="#fff8e7" />
      </g>
      {/* beak */}
      <path d="M48 44 L43 50 L48 56 L53 50 Z" fill="#f5b942" />
      {/* feet */}
      <path d="M38 79 L38 84 M44 79 L44 84 M52 79 L52 84 M58 79 L58 84" stroke="#f5b942" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
