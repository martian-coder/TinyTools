import React, { useEffect, useRef, useState } from 'react';
import { useI18n, LANGUAGES } from '../i18n/index.js';

/**
 * Flag button with a dropdown.
 *
 * The menu shows the native language name beside each flag: a flag is a country
 * rather than a language, and 🇬🇧 for English or 🇨🇳 for Chinese leaves out most
 * of the people who speak either.
 */
export default function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find((l) => l.id === lang) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${t('lang.label')}: ${current.native}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t('lang.note')}
        className="h-[34px] px-2 inline-flex items-center gap-1 rounded-md border border-slate-300
                   dark:border-slate-600 hover:border-linkedin transition"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {current.flag}
        </span>
        <span className="text-[10px] leading-none text-slate-500 dark:text-slate-400" aria-hidden="true">
          ▼
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('lang.label')}
          className="absolute right-0 mt-1 z-30 min-w-[160px] rounded-lg border border-slate-200
                     dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1"
        >
          {LANGUAGES.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={l.id === lang}
                onClick={() => {
                  setLang(l.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition
                            hover:bg-slate-100 dark:hover:bg-slate-700 ${
                              l.id === lang
                                ? 'font-semibold text-linkedin dark:text-sky-300'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
              >
                <span aria-hidden="true">{l.flag}</span>
                {l.native}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
