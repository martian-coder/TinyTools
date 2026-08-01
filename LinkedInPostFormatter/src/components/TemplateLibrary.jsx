import React from 'react';
import { TEMPLATES, HOOKS } from '../utils/templates.js';

export default function TemplateLibrary({ onUse, onInsert, drafts, onLoadDraft, onDeleteDraft }) {
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
          Structures
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
          Shapes that reliably hold attention. Replace every word — the structure is the reusable
          part, the specifics are what make it yours.
        </p>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 hover:border-linkedin transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUse(t.body)}
                  className="shrink-0 px-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 hover:border-linkedin hover:text-linkedin transition"
                >
                  Use
                </button>
              </div>
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
    </div>
  );
}
