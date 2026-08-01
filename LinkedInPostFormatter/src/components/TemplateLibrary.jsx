import React, { useState } from 'react';
import { TEMPLATES, TEMPLATE_CATEGORIES, HOOKS, CLOSERS } from '../utils/templates.js';

export default function TemplateLibrary({ onUse, onInsert, drafts, onLoadDraft, onDeleteDraft }) {
  const [category, setCategory] = useState('all');
  const [preview, setPreview] = useState(null);

  const shown =
    category === 'all' ? TEMPLATES : TEMPLATES.filter((t) => t.category === category);

  const chip = (isActive) =>
    `px-2.5 py-1 text-xs rounded-full border transition ${
      isActive
        ? 'bg-linkedin border-linkedin text-white'
        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-linkedin'
    }`;

  return (
    <div className="space-y-6">
      {drafts.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Saved drafts
          </h3>
          <div className="space-y-2">
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
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:border-linkedin hover:text-linkedin transition"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDraft(d.id)}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-red-600 transition"
                  aria-label={`Delete ${d.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          {TEMPLATES.length} structures
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          Replace every word. The structure is the reusable part — the bracketed placeholders mark
          where a real number, name or quote has to go, because that specificity is what makes any
          of these work.
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <button type="button" className={chip(category === 'all')} onClick={() => setCategory('all')}>
            All
          </button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={chip(category === c.id)}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {shown.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-linkedin transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t.name}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                </div>
                <div className="shrink-0 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPreview(preview === t.id ? null : t.id)}
                    aria-expanded={preview === t.id}
                    className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:border-linkedin transition"
                  >
                    {preview === t.id ? 'Hide' : 'Read'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUse(t.body)}
                    className="px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:border-linkedin hover:text-linkedin transition"
                  >
                    Use
                  </button>
                </div>
              </div>
              {preview === t.id && (
                <pre className="mt-2 p-2 rounded bg-slate-50 dark:bg-slate-900 text-xs whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300 leading-relaxed max-h-64 overflow-y-auto">
                  {t.body}
                </pre>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          Opening lines
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          The first line is the whole ad. Click to drop one in at the cursor.
        </p>
        <div className="space-y-1.5">
          {HOOKS.map((hook) => (
            <button
              key={hook}
              type="button"
              onClick={() => onInsert(hook)}
              className="w-full text-left text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                         text-slate-700 dark:text-slate-300 hover:border-linkedin hover:bg-linkedin-light
                         dark:hover:bg-slate-800 transition"
            >
              {hook}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
          Closing asks
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          Comments push a post back into the feed. A question someone can actually answer beats
          “thoughts?”.
        </p>
        <div className="space-y-1.5">
          {CLOSERS.map((closer) => (
            <button
              key={closer}
              type="button"
              onClick={() => onInsert(closer)}
              className="w-full text-left text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                         text-slate-700 dark:text-slate-300 hover:border-linkedin hover:bg-linkedin-light
                         dark:hover:bg-slate-800 transition"
            >
              {closer}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
