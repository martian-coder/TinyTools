import React, { useState } from 'react';
import { SYMBOLS } from '../utils/unicode.js';
import EmojiPicker from './EmojiPicker.jsx';

/**
 * The always-available actions only.
 *
 * Styling lives in the floating bar that appears at the selection, because none
 * of it can be used without one. What remains here works at the caret at any
 * time, so it earns its place above the editor.
 */
export default function Toolbar({ onInsert, onFixSpacing, onClear, hasSelection, hasText }) {
  const [panel, setPanel] = useState(null); // 'emoji' | 'symbols' | null

  const toggle = (name) => setPanel((current) => (current === name ? null : name));

  const button = (isActive) =>
    `px-2.5 py-1.5 rounded-md text-sm transition border ${
      isActive
        ? 'border-linkedin bg-linkedin-light text-linkedin dark:bg-slate-700 dark:text-white'
        : 'border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
    }`;

  return (
    <div className="border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-1 px-2 py-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => toggle('emoji')}
          aria-expanded={panel === 'emoji'}
          className={button(panel === 'emoji')}
        >
          <span aria-hidden="true">🙂</span> Emoji
        </button>

        <button
          type="button"
          onClick={() => toggle('symbols')}
          aria-expanded={panel === 'symbols'}
          className={button(panel === 'symbols')}
        >
          <span aria-hidden="true">•</span> Bullets
        </button>

        <button
          type="button"
          onClick={onFixSpacing}
          disabled={!hasText}
          title="Collapse blank-line runs and trim trailing spaces to match what LinkedIn renders"
          className={`${button(false)} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span aria-hidden="true">¶</span> Fix spacing
        </button>

        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden md:inline">
            {hasSelection ? 'Pick a style from the bar' : 'Select text to format it'}
          </span>
          <button
            type="button"
            onClick={onClear}
            disabled={!hasText}
            className="px-2 py-1.5 rounded-md text-sm text-slate-400 hover:text-red-600 hover:bg-red-50
                       dark:hover:bg-red-950 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear all
          </button>
        </span>
      </div>

      {panel === 'emoji' && (
        <div className="px-2 pb-2">
          <EmojiPicker onPick={(char) => onInsert(char)} />
        </div>
      )}

      {panel === 'symbols' && (
        <div className="px-2 pb-2">
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
        </div>
      )}
    </div>
  );
}
