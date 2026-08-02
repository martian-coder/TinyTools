import React from 'react';

/**
 * Mock of the visual a post type usually carries.
 *
 * Posts like these almost never ship as bare text — a launch has a product shot,
 * a research drop has a chart, a partnership has a logo lockup. Showing the
 * template with its visual makes the card read as a finished post and tells the
 * author what to prepare, since the image itself has to be uploaded to LinkedIn
 * separately.
 *
 * Everything is drawn as SVG from the template's own accent colour. No real
 * company marks: a placeholder lockup makes the point without borrowing anyone's
 * brand.
 */

const fade = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

function Frame({ children, accent, label }) {
  return (
    <svg viewBox="0 0 320 168" className="w-full block" role="img" aria-label={label}>
      <rect width="320" height="168" fill={fade(accent, 0.06)} />
      {children}
    </svg>
  );
}

const MOCKS = {
  barChart: (accent) => (
    <>
      <line x1="34" y1="132" x2="292" y2="132" stroke={fade(accent, 0.3)} strokeWidth="1.5" />
      {[52, 88, 124, 160, 196, 232].map((x, i) => {
        const h = [42, 61, 54, 88, 76, 108][i];
        return (
          <rect
            key={x}
            x={x}
            y={132 - h}
            width="22"
            height={h}
            rx="3"
            fill={accent}
            opacity={0.35 + i * 0.12}
          />
        );
      })}
      <rect x="34" y="26" width="86" height="8" rx="4" fill={fade(accent, 0.45)} />
      <rect x="34" y="42" width="52" height="6" rx="3" fill={fade(accent, 0.25)} />
    </>
  ),

  lineChart: (accent) => (
    <>
      <line x1="34" y1="132" x2="292" y2="132" stroke={fade(accent, 0.3)} strokeWidth="1.5" />
      <path
        d="M40 118 L86 104 L132 108 L178 78 L224 64 L282 34 L282 132 L40 132 Z"
        fill={fade(accent, 0.16)}
      />
      <path
        d="M40 118 L86 104 L132 108 L178 78 L224 64 L282 34"
        fill="none"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[[40, 118], [86, 104], [132, 108], [178, 78], [224, 64], [282, 34]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3.5" fill="#fff" stroke={accent} strokeWidth="2.5" />
      ))}
      <rect x="34" y="26" width="72" height="8" rx="4" fill={fade(accent, 0.45)} />
    </>
  ),

  screenshot: (accent) => (
    <>
      <rect x="26" y="20" width="268" height="128" rx="8" fill="#fff" stroke={fade(accent, 0.3)} />
      <rect x="26" y="20" width="268" height="22" rx="8" fill={fade(accent, 0.12)} />
      <circle cx="40" cy="31" r="3.5" fill={fade(accent, 0.4)} />
      <circle cx="52" cy="31" r="3.5" fill={fade(accent, 0.3)} />
      <circle cx="64" cy="31" r="3.5" fill={fade(accent, 0.2)} />
      <rect x="36" y="54" width="62" height="84" rx="5" fill={fade(accent, 0.14)} />
      {[62, 78, 94, 110].map((y, i) => (
        <rect key={y} x="44" y={y} width={46 - i * 6} height="5" rx="2.5" fill={fade(accent, 0.4)} />
      ))}
      <rect x="110" y="54" width="172" height="40" rx="5" fill={fade(accent, 0.2)} />
      <rect x="110" y="102" width="120" height="7" rx="3.5" fill={fade(accent, 0.3)} />
      <rect x="110" y="116" width="160" height="7" rx="3.5" fill={fade(accent, 0.2)} />
      <rect x="110" y="130" width="90" height="7" rx="3.5" fill={fade(accent, 0.2)} />
    </>
  ),

  photo: (accent) => (
    <>
      <rect x="26" y="20" width="268" height="128" rx="8" fill={fade(accent, 0.14)} />
      <circle cx="106" cy="66" r="18" fill={fade(accent, 0.4)} />
      <path d="M26 130 L104 78 L162 122 L206 96 L294 148 L26 148 Z" fill={fade(accent, 0.42)} />
      <path d="M150 148 L214 104 L294 148 Z" fill={fade(accent, 0.6)} />
    </>
  ),

  diagram: (accent) => (
    <>
      <rect x="24" y="62" width="76" height="44" rx="7" fill={fade(accent, 0.18)} stroke={fade(accent, 0.4)} />
      <rect x="122" y="62" width="76" height="44" rx="7" fill={fade(accent, 0.3)} stroke={fade(accent, 0.5)} />
      <rect x="220" y="62" width="76" height="44" rx="7" fill={accent} opacity="0.85" />
      {[[104, 118], [202, 216]].map(([x1, x2]) => (
        <g key={x1}>
          <line x1={x1} y1="84" x2={x2} y2="84" stroke={fade(accent, 0.55)} strokeWidth="2.5" />
          <path d={`M${x2 - 5} 80 L${x2} 84 L${x2 - 5} 88`} fill="none" stroke={fade(accent, 0.55)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {[[40, 0.45], [138, 0.5], [236, 0.9]].map(([x, o], i) => (
        <rect key={x} x={x} y="78" width={i === 2 ? 44 : 40} height="6" rx="3" fill={i === 2 ? '#fff' : fade(accent, o)} opacity={i === 2 ? 0.9 : 1} />
      ))}
      <rect x="24" y="26" width="94" height="8" rx="4" fill={fade(accent, 0.4)} />
    </>
  ),

  quote: (accent) => (
    <>
      <text x="30" y="76" fontSize="72" fill={fade(accent, 0.28)} fontFamily="Georgia, serif">
        “
      </text>
      <rect x="82" y="44" width="200" height="9" rx="4.5" fill={fade(accent, 0.45)} />
      <rect x="82" y="62" width="176" height="9" rx="4.5" fill={fade(accent, 0.45)} />
      <rect x="82" y="80" width="140" height="9" rx="4.5" fill={fade(accent, 0.45)} />
      <circle cx="94" cy="118" r="13" fill={accent} opacity="0.8" />
      <rect x="116" y="111" width="70" height="7" rx="3.5" fill={fade(accent, 0.4)} />
      <rect x="116" y="123" width="98" height="6" rx="3" fill={fade(accent, 0.25)} />
    </>
  ),

  logos: (accent) => (
    <>
      <rect x="42" y="52" width="82" height="64" rx="12" fill={fade(accent, 0.22)} stroke={fade(accent, 0.4)} />
      <circle cx="83" cy="84" r="19" fill={accent} opacity="0.65" />
      <text x="152" y="94" fontSize="30" fill={fade(accent, 0.5)} fontFamily="system-ui, sans-serif">
        ×
      </text>
      <rect x="196" y="52" width="82" height="64" rx="12" fill={fade(accent, 0.22)} stroke={fade(accent, 0.4)} />
      <rect x="220" y="70" width="34" height="28" rx="6" fill={accent} opacity="0.65" />
      <rect x="104" y="136" width="112" height="7" rx="3.5" fill={fade(accent, 0.3)} />
    </>
  ),

  stat: (accent) => (
    <>
      <text
        x="160"
        y="88"
        fontSize="52"
        fontWeight="700"
        textAnchor="middle"
        fill={accent}
        fontFamily="system-ui, sans-serif"
      >
        70%
      </text>
      <rect x="94" y="104" width="132" height="9" rx="4.5" fill={fade(accent, 0.35)} />
      <rect x="120" y="122" width="80" height="7" rx="3.5" fill={fade(accent, 0.22)} />
      <rect x="34" y="30" width="60" height="7" rx="3.5" fill={fade(accent, 0.3)} />
    </>
  ),

  carousel: (accent) => (
    <>
      <rect x="52" y="30" width="216" height="108" rx="8" fill={fade(accent, 0.12)} />
      <rect x="40" y="38" width="216" height="108" rx="8" fill={fade(accent, 0.2)} />
      <rect x="28" y="46" width="216" height="102" rx="8" fill="#fff" stroke={fade(accent, 0.4)} />
      <rect x="44" y="62" width="104" height="10" rx="5" fill={accent} opacity="0.7" />
      <rect x="44" y="82" width="150" height="7" rx="3.5" fill={fade(accent, 0.3)} />
      <rect x="44" y="96" width="128" height="7" rx="3.5" fill={fade(accent, 0.25)} />
      <rect x="44" y="110" width="140" height="7" rx="3.5" fill={fade(accent, 0.25)} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={264 + i * 0} cy={62 + i * 14} r="4" fill={fade(accent, i === 0 ? 0.7 : 0.25)} />
      ))}
    </>
  ),
};

export const MEDIA_TYPES = Object.keys(MOCKS);

export default function MediaMock({ type, accent = '#0A66C2', label }) {
  const draw = MOCKS[type];
  if (!draw) return null;
  return (
    <Frame accent={accent} label={label || `${type} visual`}>
      {draw(accent)}
    </Frame>
  );
}
