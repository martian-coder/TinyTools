import type { ThemeName } from '../types';

export interface ThemeVars {
  '--base': string;
  '--g1': string;
  '--g2': string;
  '--g3': string;
  '--accent': string;
  '--accent2': string;
  '--text': string;
  '--dim': string;
  '--glass': string;
  '--glass2': string;
  '--line': string;
  '--in': string;
}

export interface ThemeMeta {
  label: string;
  swatch: string;
  isLight: boolean;
  vars: ThemeVars;
}

export const THEMES: Record<ThemeName, ThemeMeta> = {
  aurora: {
    label: 'Aurora',
    swatch: 'linear-gradient(135deg,#7c83ff,#22d3ee)',
    isLight: false,
    vars: {
      '--base': '#0b1020',
      '--g1': 'rgba(124,131,255,.55)',
      '--g2': 'rgba(34,211,238,.38)',
      '--g3': 'rgba(168,85,247,.45)',
      '--accent': '#7c83ff',
      '--accent2': '#22d3ee',
      '--text': '#eef1ff',
      '--dim': 'rgba(238,241,255,.55)',
      '--glass': 'rgba(255,255,255,.07)',
      '--glass2': 'rgba(255,255,255,.13)',
      '--line': 'rgba(255,255,255,.14)',
      '--in': 'rgba(255,255,255,.10)',
    },
  },
  sunset: {
    label: 'Sunset',
    swatch: 'linear-gradient(135deg,#fb7185,#fb923c)',
    isLight: false,
    vars: {
      '--base': '#1a0b14',
      '--g1': 'rgba(244,63,94,.5)',
      '--g2': 'rgba(249,115,22,.42)',
      '--g3': 'rgba(217,70,239,.45)',
      '--accent': '#fb7185',
      '--accent2': '#fb923c',
      '--text': '#fff0f3',
      '--dim': 'rgba(255,240,243,.55)',
      '--glass': 'rgba(255,255,255,.07)',
      '--glass2': 'rgba(255,255,255,.13)',
      '--line': 'rgba(255,255,255,.15)',
      '--in': 'rgba(255,255,255,.10)',
    },
  },
  noir: {
    label: 'Noir',
    swatch: 'linear-gradient(135deg,#60a5fa,#818cf8)',
    isLight: false,
    vars: {
      '--base': '#08080d',
      '--g1': 'rgba(59,130,246,.34)',
      '--g2': 'rgba(99,102,241,.3)',
      '--g3': 'rgba(14,165,233,.26)',
      '--accent': '#60a5fa',
      '--accent2': '#818cf8',
      '--text': '#eaf0ff',
      '--dim': 'rgba(234,240,255,.5)',
      '--glass': 'rgba(255,255,255,.05)',
      '--glass2': 'rgba(255,255,255,.1)',
      '--line': 'rgba(255,255,255,.1)',
      '--in': 'rgba(255,255,255,.07)',
    },
  },
  daylight: {
    label: 'Daylight',
    swatch: 'linear-gradient(135deg,#6366f1,#06b6d4)',
    isLight: true,
    vars: {
      '--base': '#e9ecf9',
      '--g1': 'rgba(124,131,255,.4)',
      '--g2': 'rgba(34,211,238,.3)',
      '--g3': 'rgba(196,181,253,.45)',
      '--accent': '#6366f1',
      '--accent2': '#06b6d4',
      '--text': '#1c2030',
      '--dim': 'rgba(28,32,48,.55)',
      '--glass': 'rgba(255,255,255,.55)',
      '--glass2': 'rgba(255,255,255,.72)',
      '--line': 'rgba(255,255,255,.85)',
      '--in': 'rgba(255,255,255,.78)',
    },
  },
};

export const CATEGORY_COLORS = {
  clean:    { bg: 'rgba(16,185,129,.16)',  text: '#34d399', border: 'rgba(16,185,129,.3)' },
  abusive:  { bg: 'rgba(244,63,94,.16)',   text: '#fb7185', border: 'rgba(244,63,94,.3)'  },
  spam:     { bg: 'rgba(245,158,11,.16)',  text: '#fbbf24', border: 'rgba(245,158,11,.3)' },
  business: { bg: 'rgba(14,165,233,.16)',  text: '#38bdf8', border: 'rgba(14,165,233,.3)' },
  promo:    { bg: 'rgba(139,92,246,.16)',  text: '#a78bfa', border: 'rgba(139,92,246,.3)' },
};
