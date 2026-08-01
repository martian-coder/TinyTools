import React, { useMemo, useState } from 'react';
import { CATEGORIES, searchEmoji, EMOJI_COUNT } from '../utils/emoji.js';

const RECENT_KEY = 'lpf.recentEmoji';
const RECENT_MAX = 24;

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function EmojiButton({ item, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(item.c)}
      title={item.k.split(' ').slice(0, 4).join(', ')}
      aria-label={item.k.split(' ')[0]}
      className="w-9 h-9 flex items-center justify-center text-xl rounded-md transition
                 hover:bg-linkedin-light dark:hover:bg-slate-700"
    >
      {item.c}
    </button>
  );
}

export default function EmojiPicker({ onPick }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('popular');
  const [recent, setRecent] = useState(readRecent);

  const results = useMemo(() => searchEmoji(query), [query]);

  const pick = (char) => {
    onPick(char);
    setRecent((current) => {
      const next = [char, ...current.filter((c) => c !== char)].slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const category = CATEGORIES.find((c) => c.id === active);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${EMOJI_COUNT} emoji — try "growth", "check", "thanks"`}
        aria-label="Search emoji"
        className="w-full px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600
                   bg-white dark:bg-slate-900 outline-none focus:border-linkedin"
      />

      {query ? (
        results.length ? (
          <div className="flex flex-wrap gap-0.5">
            {results.map((item) => (
              <EmojiButton key={item.c} item={item} onPick={pick} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            Nothing matches “{query}”. Try a plainer word — the keywords describe what the emoji is
            used for, not its official Unicode name.
          </p>
        )
      ) : (
        <>
          {recent.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                Recent
              </div>
              <div className="flex flex-wrap gap-0.5">
                {recent.map((c) => (
                  <EmojiButton key={c} item={{ c, k: 'recent' }} onPick={pick} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActive(cat.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition ${
                  active === cat.id
                    ? 'bg-linkedin border-linkedin text-white'
                    : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-linkedin'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {category && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">{category.hint}</p>
              <div className="flex flex-wrap gap-0.5">
                {category.items.map((item) => (
                  <EmojiButton key={item.c} item={item} onPick={pick} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-2">
        LinkedIn post text is plain text, so GIFs cannot be embedded inline — they only work in
        comments, messages, or as attached media. Emoji are the one visual that renders in the body.
      </p>
    </div>
  );
}
