import type { ThemeName } from '../types';

export interface ThemeTokens {
  base: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  accent: string;
  accent2: string;
  text: string;
  textMuted: string;
  bubble: string;
  bubbleOut: string;
  navBg: string;
  isLight: boolean;
}

export const THEMES: Record<ThemeName, ThemeTokens> = {
  aurora: {
    base: '#0b1020',
    surface: 'rgba(255,255,255,0.07)',
    surfaceStrong: 'rgba(255,255,255,0.13)',
    border: 'rgba(255,255,255,0.14)',
    accent: '#7c83ff',
    accent2: '#22d3ee',
    text: '#eef1ff',
    textMuted: 'rgba(238,241,255,0.55)',
    bubble: 'rgba(255,255,255,0.10)',
    bubbleOut: 'rgba(124,131,255,0.30)',
    navBg: 'rgba(11,16,32,0.82)',
    isLight: false,
  },
  sunset: {
    base: '#1a0b14',
    surface: 'rgba(255,255,255,0.07)',
    surfaceStrong: 'rgba(255,255,255,0.13)',
    border: 'rgba(255,255,255,0.14)',
    accent: '#fb7185',
    accent2: '#fb923c',
    text: '#fff0f3',
    textMuted: 'rgba(255,240,243,0.55)',
    bubble: 'rgba(255,255,255,0.10)',
    bubbleOut: 'rgba(251,113,133,0.30)',
    navBg: 'rgba(26,11,20,0.82)',
    isLight: false,
  },
  noir: {
    base: '#08080d',
    surface: 'rgba(255,255,255,0.06)',
    surfaceStrong: 'rgba(255,255,255,0.11)',
    border: 'rgba(255,255,255,0.12)',
    accent: '#60a5fa',
    accent2: '#818cf8',
    text: '#e8eaf6',
    textMuted: 'rgba(232,234,246,0.50)',
    bubble: 'rgba(255,255,255,0.08)',
    bubbleOut: 'rgba(96,165,250,0.25)',
    navBg: 'rgba(8,8,13,0.88)',
    isLight: false,
  },
  daylight: {
    base: '#e9ecf9',
    surface: 'rgba(0,0,0,0.05)',
    surfaceStrong: 'rgba(0,0,0,0.10)',
    border: 'rgba(0,0,0,0.10)',
    accent: '#6366f1',
    accent2: '#06b6d4',
    text: '#1c2030',
    textMuted: 'rgba(28,32,48,0.55)',
    bubble: 'rgba(0,0,0,0.06)',
    bubbleOut: 'rgba(99,102,241,0.20)',
    navBg: 'rgba(233,236,249,0.88)',
    isLight: true,
  },
};

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  clean:    { bg: 'rgba(16,185,129,0.15)',  text: '#34d399', border: 'rgba(16,185,129,0.30)' },
  abusive:  { bg: 'rgba(244,63,94,0.15)',   text: '#fb7185', border: 'rgba(244,63,94,0.30)' },
  spam:     { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.30)' },
  business: { bg: 'rgba(14,165,233,0.15)',  text: '#38bdf8', border: 'rgba(14,165,233,0.30)' },
  promo:    { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa', border: 'rgba(139,92,246,0.30)' },
};

export function applyTheme(theme: ThemeTokens) {
  const root = document.documentElement;
  root.style.setProperty('--base', theme.base);
  root.style.setProperty('--surface', theme.surface);
  root.style.setProperty('--surface-strong', theme.surfaceStrong);
  root.style.setProperty('--border', theme.border);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent2', theme.accent2);
  root.style.setProperty('--text', theme.text);
  root.style.setProperty('--text-muted', theme.textMuted);
  root.style.setProperty('--bubble', theme.bubble);
  root.style.setProperty('--bubble-out', theme.bubbleOut);
  root.style.setProperty('--nav-bg', theme.navBg);
}
