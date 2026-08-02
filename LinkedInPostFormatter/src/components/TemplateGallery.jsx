import React, { useMemo, useState } from 'react';
import { SHOWCASE, SHOWCASE_CATEGORIES } from '../utils/showcase.js';
import { TEMPLATES, TEMPLATE_CATEGORIES, HOOKS, CLOSERS } from '../utils/templates.js';
import { compileMarkup } from '../utils/unicode.js';
import MediaMock from './MediaMock.jsx';
import BrandMark from './BrandMark.jsx';

const NEUTRAL = { name: 'Your Name', headline: 'Your headline', accent: '#334155' };

/**
 * Showcase templates arrive pre-formatted; the plain structures stay plain, since
 * their value is the shape rather than the styling. Compiling once at module load
 * keeps the gallery from re-running the Unicode transform on every render.
 */
const ALL = [
  ...SHOWCASE.map((t) => ({ ...t, formatted: true, compiled: compileMarkup(t.body) })),
  ...TEMPLATES.map((t) => ({ ...t, formatted: false, compiled: t.body, persona: NEUTRAL })),
];

const CATEGORIES = (() => {
  const seen = new Map();
  [...SHOWCASE_CATEGORIES, ...TEMPLATE_CATEGORIES].forEach((c) => {
    if (!seen.has(c.id)) seen.set(c.id, c);
  });
  return [...seen.values()];
})();

function Card({ template, onUse }) {
  const [open, setOpen] = useState(false);
  const persona = template.persona || NEUTRAL;
  const initial = persona.name.trim().charAt(0).toUpperCase();

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden hover:border-linkedin transition">
      {/* A LinkedIn-shaped card, so the template is judged as a post rather than as source text. */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {persona.mark ? (
            <BrandMark mark={persona.mark} accent={persona.accent} size={40} />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
              style={{ backgroundColor: persona.accent }}
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {persona.name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {persona.headline}
            </div>
          </div>
          {template.formatted && (
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-linkedin-light text-linkedin dark:bg-slate-700 dark:text-sky-300 shrink-0">
              Formatted
            </span>
          )}
        </div>
      </div>

      <div className="relative px-3 py-2 flex-1">
        <pre
          className={`whitespace-pre-wrap break-words font-sans text-[13px] leading-[1.5] text-slate-700 dark:text-slate-300 ${
            open ? '' : 'max-h-52 overflow-hidden'
          }`}
        >
          {template.compiled}
        </pre>
        {!open && (
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none" />
        )}
      </div>

      {template.media && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          <MediaMock
            type={template.media.type}
            accent={persona.accent}
            label={`Suggested visual: ${template.media.type}`}
          />
          <p className="px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Suggested visual:
            </span>{' '}
            {template.media.caption}
          </p>
        </div>
      )}

      <div className="p-3 pt-2 border-t border-slate-100 dark:border-slate-700">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {template.name}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
          {template.description}
        </p>
        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            onClick={() => onUse(template.compiled)}
            className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md bg-linkedin text-white hover:bg-linkedin-dark transition"
          >
            Use this
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:border-linkedin transition"
          >
            {open ? 'Less' : 'Read'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function TemplateGallery({ onUse, onInsert, drafts, onLoadDraft, onDeleteDraft }) {
  const [category, setCategory] = useState('all');
  const [onlyFormatted, setOnlyFormatted] = useState(false);

  const shown = useMemo(
    () =>
      ALL.filter(
        (t) =>
          (category === 'all' || t.category === category) && (!onlyFormatted || t.formatted)
      ),
    [category, onlyFormatted]
  );

  const chip = (isActive) =>
    `px-2.5 py-1 text-xs rounded-full border transition ${
      isActive
        ? 'bg-linkedin border-linkedin text-white'
        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-linkedin'
    }`;

  return (
    <section className="max-w-7xl mx-auto px-4 pb-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Templates</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {shown.length} of {ALL.length}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
          Ready-made posts you can drop straight in. The ones marked{' '}
          <span className="font-semibold text-linkedin">Formatted</span> already carry bold
          headings, bullets and dividers. Replace the bracketed placeholders — they mark where a
          real number, name or link has to go, which is the part that makes any of these work.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          The visual on each card shows the kind of image that post type usually carries — a chart,
          a product shot, a logo lockup. It is a guide for what to prepare, not something that
          copies across: LinkedIn post text cannot contain an image, so you attach the file on
          LinkedIn yourself. Hashtags are left plain on purpose, because LinkedIn cannot match a
          styled one.
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <button type="button" className={chip(category === 'all')} onClick={() => setCategory('all')}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={chip(category === c.id)}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
          <span className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1" />
          <button
            type="button"
            className={chip(onlyFormatted)}
            onClick={() => setOnlyFormatted((v) => !v)}
            aria-pressed={onlyFormatted}
          >
            Formatted only
          </button>
        </div>

        {/* items-start stops a row stretching to its tallest card. Without it,
            expanding one card grew its siblings while their text stayed clamped,
            leaving cut-off text above a block of dead space. */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 items-start">
          {shown.map((t) => (
            <Card key={t.id} template={t} onUse={onUse} />
          ))}
        </div>

        {shown.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
            Nothing in this combination. Try another category.
          </p>
        )}

        <div className="grid gap-5 md:grid-cols-2 mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Opening lines
            </h3>
            <div className="space-y-1.5">
              {HOOKS.slice(0, 6).map((hook) => (
                <button
                  key={hook}
                  type="button"
                  onClick={() => onInsert(hook)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-linkedin hover:bg-linkedin-light dark:hover:bg-slate-700 transition"
                >
                  {hook}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Closing asks
            </h3>
            <div className="space-y-1.5">
              {CLOSERS.slice(0, 6).map((closer) => (
                <button
                  key={closer}
                  type="button"
                  onClick={() => onInsert(closer)}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-linkedin hover:bg-linkedin-light dark:hover:bg-slate-700 transition"
                >
                  {closer}
                </button>
              ))}
            </div>
          </div>
        </div>

        {drafts.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Your saved drafts
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {d.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(d.savedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLoadDraft(d)}
                    className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:border-linkedin transition"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(d.id)}
                    aria-label={`Delete ${d.name}`}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-red-600 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
