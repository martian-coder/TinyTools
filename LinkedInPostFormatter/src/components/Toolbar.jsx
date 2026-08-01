import React, { useState } from 'react';
import { STYLES, SYMBOLS, applyStyle } from '../utils/unicode.js';
import EmojiPicker from './EmojiPicker.jsx';

/**
 * Each style button renders its own label in the style it applies, so the button
 * is its own preview — no legend or icon vocabulary to learn.
 *
 * The visible glyphs are styled Unicode, which assistive tech reads as character
 * names rather than words, so aria-label carries the real name. Same problem this
 * tool warns authors about, and it applies to the tool's own interface.
 */
function StyleButton({ style, onApply, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onApply(style.id)}
      disabled={disabled}
      aria-label={style.label}
      title={`${style.label} — ${style.description}`}
      className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-800 transition
                 hover:border-linkedin hover:bg-linkedin-light
                 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:bg-white
                 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      {applyStyle(style.sample, style.id)}
    </button>
  );
}

export default function Toolbar({ onApply, onInsert, onFixSpacing, onClear, hasSelection, hasText }) {
  const [showSymbols, setShowSymbols] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 p-3 space-y-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Style
            </span>
            {!hasSelection && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                select some text first
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((style) => (
              <StyleButton key={style.id} style={style} onApply={onApply} disabled={!hasSelection} />
            ))}
            <button
              type="button"
              onClick={() => onApply('plain')}
              disabled={!hasSelection}
              title="Remove all styling from the selection"
              className="px-3 py-1.5 rounded-md border border-slate-300 bg-slate-50 text-sm text-slate-600 transition
                         hover:border-slate-400 hover:bg-slate-100
                         disabled:opacity-40 disabled:cursor-not-allowed
                         dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Clear style
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setShowEmoji((v) => !v);
            setShowSymbols(false);
          }}
          className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-700 transition
                     hover:border-linkedin hover:bg-linkedin-light
                     dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {showEmoji ? 'Hide emoji' : 'Emoji'}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowSymbols((v) => !v);
            setShowEmoji(false);
          }}
          className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-700 transition
                     hover:border-linkedin hover:bg-linkedin-light
                     dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {showSymbols ? 'Hide' : 'Insert'} bullets &amp; dividers
        </button>

        <button
          type="button"
          onClick={onFixSpacing}
          disabled={!hasText}
          title="Collapse blank-line runs and trim trailing spaces to match what LinkedIn renders"
          className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-700 transition
                     hover:border-linkedin hover:bg-linkedin-light
                     disabled:opacity-40 disabled:cursor-not-allowed
                     dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Fix spacing
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={!hasText}
          className="px-3 py-1.5 rounded-md border border-transparent text-sm text-slate-500 transition
                     hover:text-red-600 hover:border-red-200 hover:bg-red-50
                     disabled:opacity-40 disabled:cursor-not-allowed
                     dark:text-slate-400 dark:hover:bg-red-950 dark:hover:border-red-900"
        >
          Clear all
        </button>
      </div>

      {showEmoji && <EmojiPicker onPick={(char) => onInsert(char)} />}

      {showSymbols && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3 bg-slate-50 dark:bg-slate-800/50">
          {[
            ['Bullets', SYMBOLS.bullets],
            ['Numbers', SYMBOLS.numbers],
            ['Dividers', SYMBOLS.dividers],
          ].map(([label, items]) => (
            <div key={label}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                {label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    aria-label={`Insert ${label.replace(/s$/, '')} ${symbol}`}
                    onClick={() => onInsert(label === 'Dividers' ? `\n${symbol}\n` : `${symbol} `)}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white text-sm transition
                               hover:border-linkedin hover:bg-linkedin-light
                               dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
