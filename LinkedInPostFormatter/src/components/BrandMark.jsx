import React from 'react';

/**
 * Designed logo marks for the template personas.
 *
 * A letter in a circle reads as a placeholder, which made the cards look like
 * mockups rather than posts. These are proper abstract marks — the geometric
 * kind real companies use — so a template card carries the weight of a real
 * brand.
 *
 * They are original shapes belonging to invented companies. A real company's
 * mark on invented post text would present fabricated content as that company's
 * own, which is a different thing from styling a template well.
 */
const MARKS = {
  // Overlapping arcs — the "connected" mark common in software.
  arcs: (c) => (
    <>
      <circle cx="18" cy="20" r="9" fill="#fff" opacity="0.9" />
      <circle cx="28" cy="20" r="9" fill="#fff" opacity="0.55" />
    </>
  ),
  // Stacked chevrons, reading as forward motion.
  chevron: () => (
    <path
      d="M13 13 L23 23 L13 33 M23 13 L33 23 L23 33"
      fill="none"
      stroke="#fff"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  // A hexagon outline — infrastructure and platform companies.
  hex: () => (
    <path
      d="M23 10 L34 16.5 L34 29.5 L23 36 L12 29.5 L12 16.5 Z"
      fill="none"
      stroke="#fff"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
  ),
  // Ascending bars, for anything data-led.
  bars: () => (
    <>
      <rect x="12" y="26" width="6" height="10" rx="2" fill="#fff" opacity="0.6" />
      <rect x="20" y="19" width="6" height="17" rx="2" fill="#fff" opacity="0.8" />
      <rect x="28" y="11" width="6" height="25" rx="2" fill="#fff" />
    </>
  ),
  // A rotated square inside a ring.
  orbit: () => (
    <>
      <circle cx="23" cy="23" r="12" fill="none" stroke="#fff" strokeWidth="3" opacity="0.55" />
      <rect x="17" y="17" width="12" height="12" rx="2" transform="rotate(45 23 23)" fill="#fff" />
    </>
  ),
  // Three dots and a connecting stroke — networks and people.
  nodes: () => (
    <>
      <path d="M15 30 L23 15 L31 30" fill="none" stroke="#fff" strokeWidth="3" opacity="0.6" />
      <circle cx="23" cy="14" r="4.5" fill="#fff" />
      <circle cx="14" cy="31" r="4.5" fill="#fff" />
      <circle cx="32" cy="31" r="4.5" fill="#fff" />
    </>
  ),
  // A soft aperture, for anything design or media adjacent.
  aperture: () => (
    <>
      <circle cx="23" cy="23" r="12" fill="#fff" opacity="0.25" />
      <path d="M23 11 A12 12 0 0 1 33.4 29 Z" fill="#fff" opacity="0.9" />
      <circle cx="23" cy="23" r="4" fill="#fff" />
    </>
  ),
  // Interlocking brackets, reading as partnership.
  link: () => (
    <>
      <path d="M20 15 h-4 a8 8 0 0 0 0 16 h4" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M26 15 h4 a8 8 0 0 1 0 16 h-4" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M18 23 h10" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
};

export const MARK_NAMES = Object.keys(MARKS);

export default function BrandMark({ mark, accent = '#0A66C2', size = 40, className = '' }) {
  const draw = MARKS[mark] || MARKS.arcs;
  return (
    <svg
      viewBox="0 0 46 46"
      width={size}
      height={size}
      className={`rounded-lg shrink-0 ${className}`}
      role="img"
      aria-label="Company logo"
    >
      <rect width="46" height="46" rx="11" fill={accent} />
      {draw(accent)}
    </svg>
  );
}
