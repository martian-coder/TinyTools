import React, { useMemo, useState } from 'react';
import { SYMBOL_GROUPS, searchSymbols, SYMBOL_COUNT } from '../utils/symbols.js';

const RECENT_KEY = 'lpf.recentSymbols';
const RECENT_MAX = 20;

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Dividers want their own line; list markers want a trailing space. */
function wrap(symbol, group) {
  if (group === 'dividers') return `\n${symbol}\n`;
  if (group === 'bullets' || group === 'numbers') return `${symbol} `;
  return symbol;
}

function SymbolButton({ item, onPick, wide }) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      title={item.k.split(' ').slice(0, 4).join(', ')}
      aria-label={item.k.split(' ')[0]}
      className={`${wide ? 'px-2' : 'w-9'} h-9 flex items-center justify-center rounded-md
                  border border-transparent hover:border-linkedin hover:bg-linkedin-light
                  dark:hover:bg-slate-700 transition text-slate-800 dark:text-slate-100
                  ${wide ? 'text-xs font-mono' : 'text-lg'}`}
    >
      {item.c}
    </button>
  );
}

export default function SymbolPicker({ onPick }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('bullets');
  const [recent, setRecent] = useState(readRecent);

  const results = useMemo(() => searchSymbols(query), [query]);
  const group = SYMBOL_GROUPS.find((g) => g.id === active);

  const pick = (item) => {
    onPick(wrap(item.c, item.group || active));
    setRecent((current) => {
      const next = [item.c, ...current.filter((c) => c !== item.c)].slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Multi-character entries (dividers, progress bars) need a wider button.
  const isWide = (c) => [...c].length > 2;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${SYMBOL_COUNT} symbols — try "arrow", "check", "divider"`}
        aria-label="Search symbols"
        className="w-full px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600
                   bg-white dark:bg-slate-900 outline-none focus:border-linkedin"
      />

      {query ? (
        results.length ? (
          <div className="flex flex-wrap gap-1">
            {results.map((item) => (
              <SymbolButton key={item.c} item={item} onPick={pick} wide={isWide(item.c)} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            Nothing matches “{query}”. The keywords describe what a symbol is used for, so plainer
            words work better than official Unicode names.
          </p>
        )
      ) : (
        <>
          {recent.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Recent
              </div>
              <div className="flex flex-wrap gap-1">
                {recent.map((c) => (
                  <SymbolButton key={c} item={{ c, k: 'recent' }} onPick={pick} wide={isWide(c)} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {SYMBOL_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActive(g.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${
                  active === g.id
                    ? 'bg-linkedin border-linkedin text-white'
                    : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-linkedin'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          {group && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">{group.hint}</p>
              <div className="flex flex-wrap gap-1">
                {group.items.map((item) => (
                  <SymbolButton
                    key={item.c}
                    item={{ ...item, group: group.id }}
                    onPick={pick}
                    wide={isWide(item.c)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
