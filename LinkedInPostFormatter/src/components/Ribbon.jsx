import React, { useEffect, useRef, useState } from 'react';
import { STYLES, applyStyle } from '../utils/unicode.js';
import { LIMITS, limitById } from '../utils/limits.js';
import EmojiPicker from './EmojiPicker.jsx';
import SymbolPicker from './SymbolPicker.jsx';

// The conventional five sit on the ribbon; the decorative ones live behind "Aa".
const PRIMARY = ['bold', 'italic', 'underline', 'strikethrough', 'monospace'];
const SECONDARY = STYLES.filter((s) => !PRIMARY.includes(s.id));

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Icon = {
  undo: (
    <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
      <path d="M3 8h7a3 3 0 0 1 0 6H7" />
      <path d="M6 5 3 8l3 3" />
    </svg>
  ),
  redo: (
    <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
      <path d="M13 8H6a3 3 0 0 0 0 6h3" />
      <path d="M10 5l3 3-3 3" />
    </svg>
  ),
  bulletList: (
    <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
      <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M6.5 4H14M6.5 8H14M6.5 12H14" />
    </svg>
  ),
  numberList: (
    <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
      <path d="M6.5 4H14M6.5 8H14M6.5 12H14" />
      <text x="1" y="5.6" fontSize="5" fill="currentColor" stroke="none">1</text>
      <text x="1" y="9.8" fontSize="5" fill="currentColor" stroke="none">2</text>
      <text x="1" y="14" fontSize="5" fill="currentColor" stroke="none">3</text>
    </svg>
  ),
  divider: (
    <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
      <path d="M2 8h12" />
      <path d="M4 4h8M4 12h8" opacity="0.35" />
    </svg>
  ),
  clearFormat: (
    <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
      <path d="M6 3h7M9.5 3 7 13" />
      <path d="M2 2l12 12" />
    </svg>
  ),
  paragraph: (
    <svg viewBox="0 0 16 16" width="15" height="15" {...stroke}>
      <path d="M9 3v10M12 3v10M9 3H6.5a3 3 0 0 0 0 6H9" />
    </svg>
  ),
};

function Divider() {
  return <span className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1 shrink-0" />;
}

function Btn({ onClick, disabled, title, label, active, children, wide }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={`h-8 ${wide ? 'px-2' : 'w-8'} inline-flex items-center justify-center gap-1 rounded-md
                  text-slate-600 dark:text-slate-300 transition shrink-0
                  hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-linkedin
                  disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent
                  disabled:hover:text-slate-600 ${
                    active ? 'bg-linkedin-light text-linkedin dark:bg-slate-700 dark:text-white' : ''
                  }`}
    >
      {children}
    </button>
  );
}

/**
 * Persistent formatting ribbon.
 *
 * Style buttons stay enabled without a selection and explain themselves when
 * pressed, rather than greying out. A disabled control tells you nothing about
 * why it is disabled, and "select text first" is the one thing a new user needs
 * to hear.
 */
export default function Ribbon({
  onApply,
  onToggleList,
  onInsert,
  onFixSpacing,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  hasSelection,
  hasText,
  used,
}) {
  const [panel, setPanel] = useState(null); // 'emoji' | 'symbols' | 'styles'
  const [hint, setHint] = useState('');
  const [target, setTarget] = useState('post');
  const hintTimer = useRef(null);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const flash = (message) => {
    setHint(message);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), 2200);
  };

  const needsSelection = (run) => () => {
    if (!hasSelection) {
      flash('Select some text first, then pick a style.');
      return;
    }
    run();
  };

  const toggle = (name) => setPanel((current) => (current === name ? null : name));

  const field = limitById(target);
  const over = used > field.limit;
  const near = !over && used > field.limit * 0.9;

  return (
    <div className="border-b border-slate-200 dark:border-slate-700">
      {/* Formatting */}
      <div className="flex items-center gap-0.5 px-2 pt-1.5 flex-wrap">
        <Btn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" label="Undo">
          {Icon.undo}
        </Btn>
        <Btn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" label="Redo">
          {Icon.redo}
        </Btn>

        <Divider />

        <Btn
          onClick={needsSelection(() => onApply('bold'))}
          title="Bold — headlines and key points"
          label="Bold"
        >
          <span className="font-bold text-[15px]">B</span>
        </Btn>
        <Btn
          onClick={needsSelection(() => onApply('italic'))}
          title="Italic — subtle emphasis"
          label="Italic"
        >
          <span className="italic font-serif text-[15px]">I</span>
        </Btn>
        <Btn
          onClick={needsSelection(() => onApply('underline'))}
          title="Underline"
          label="Underline"
        >
          <span className="underline text-[15px]">U</span>
        </Btn>
        <Btn
          onClick={needsSelection(() => onApply('strikethrough'))}
          title="Strikethrough — before and after"
          label="Strikethrough"
        >
          <span className="line-through text-[15px]">S</span>
        </Btn>
        <Btn
          onClick={needsSelection(() => onApply('monospace'))}
          title="Monospace — code, data, metrics"
          label="Monospace"
        >
          <span className="font-mono text-xs">&lt;/&gt;</span>
        </Btn>

        <Btn
          onClick={() => toggle('styles')}
          active={panel === 'styles'}
          title="More styles"
          label="More styles"
          wide
        >
          <span className="text-[13px] font-medium">Aa</span>
          <span className="text-[9px] leading-none" aria-hidden="true">▼</span>
        </Btn>

        <Btn
          onClick={needsSelection(() => onApply('plain'))}
          title="Remove formatting from the selection"
          label="Remove formatting"
        >
          {Icon.clearFormat}
        </Btn>

        <Divider />

        <Btn
          onClick={() => onToggleList('bullet')}
          title="Bulleted list — toggles • on the selected lines"
          label="Bulleted list"
        >
          {Icon.bulletList}
        </Btn>
        <Btn
          onClick={() => onToggleList('number')}
          title="Numbered list — toggles numbering on the selected lines"
          label="Numbered list"
        >
          {Icon.numberList}
        </Btn>
        <Btn
          onClick={() => onInsert('\n━━━━━━━━━━\n')}
          title="Insert a divider line"
          label="Insert divider"
        >
          {Icon.divider}
        </Btn>
      </div>

      {/* Inserts and utilities */}
      <div className="flex items-center gap-0.5 px-2 pb-1.5 pt-1 flex-wrap">
        <Btn
          onClick={() => toggle('emoji')}
          active={panel === 'emoji'}
          title="Emoji"
          label="Emoji"
          wide
        >
          <span aria-hidden="true">🙂</span>
          <span className="text-[13px]">Emoji</span>
        </Btn>
        <Btn
          onClick={() => toggle('symbols')}
          active={panel === 'symbols'}
          title="Bullets, numbers and dividers"
          label="Symbols"
          wide
        >
          <span aria-hidden="true">•</span>
          <span className="text-[13px]">Symbols</span>
        </Btn>
        <Btn
          onClick={onFixSpacing}
          disabled={!hasText}
          title="Collapse blank-line runs and trim trailing spaces to match what LinkedIn renders"
          label="Fix spacing"
          wide
        >
          {Icon.paragraph}
          <span className="text-[13px]">Fix spacing</span>
        </Btn>

        <span className="ml-auto flex items-center gap-3 pr-1">
          {hint && (
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">{hint}</span>
          )}
          <span
            className="flex items-center gap-1.5"
            title="Styled characters count as two against LinkedIn's limit"
          >
            <span
              className={`text-xs tabular-nums ${
                over
                  ? 'text-red-600 dark:text-red-400 font-semibold'
                  : near
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {used.toLocaleString()} / {field.limit.toLocaleString()}
            </span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Count against which LinkedIn field"
              className="text-xs bg-transparent border border-slate-300 dark:border-slate-600
                         rounded px-1 py-0.5 text-slate-500 dark:text-slate-400 outline-none
                         focus:border-linkedin cursor-pointer"
            >
              {LIMITS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </span>
          <button
            type="button"
            onClick={onClear}
            disabled={!hasText}
            className="text-xs text-slate-400 hover:text-red-600 transition disabled:opacity-35
                       disabled:cursor-not-allowed"
          >
            Clear all
          </button>
        </span>
      </div>

      {panel === 'styles' && (
        <div className="px-2 pb-2">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2">
            <div className="flex flex-wrap gap-1.5">
              {SECONDARY.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={needsSelection(() => onApply(style.id))}
                  title={style.description}
                  aria-label={style.label}
                  className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm transition
                             hover:border-linkedin hover:bg-linkedin-light
                             dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  {applyStyle(style.sample, style.id)}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Decorative faces. They read poorly to screen readers and are invisible to LinkedIn
              search, so keep them to a word or two.
            </p>
          </div>
        </div>
      )}

      {panel === 'emoji' && (
        <div className="px-2 pb-2">
          <EmojiPicker onPick={(char) => onInsert(char)} />
        </div>
      )}

      {panel === 'symbols' && (
        <div className="px-2 pb-2">
          <SymbolPicker onPick={onInsert} />
        </div>
      )}
    </div>
  );
}
