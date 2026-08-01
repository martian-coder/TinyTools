import React from 'react';
import { CHAR_LIMIT } from '../utils/analyze.js';

const SEVERITY = {
  error: {
    dot: 'bg-red-500',
    box: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    label: 'Fix',
  },
  warning: {
    dot: 'bg-amber-500',
    box: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
    label: 'Consider',
  },
  info: {
    dot: 'bg-sky-500',
    box: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40',
    label: 'Note',
  },
};

function Meter({ used, limit }) {
  const pct = Math.min((used / limit) * 100, 100);
  const over = used > limit;
  const near = !over && used > limit * 0.9;
  const colour = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-linkedin';

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {used.toLocaleString()}
          <span className="text-slate-400 dark:text-slate-500"> / {limit.toLocaleString()}</span>
        </span>
        {over && (
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            {(used - limit).toLocaleString()} over
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export default function Insights({ result }) {
  const { findings, counts, ratio, emoji } = result;
  const inflated = counts.utf16 - counts.codePoints;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Meter used={counts.utf16} limit={CHAR_LIMIT} />
        {inflated > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {inflated.toLocaleString()} of those characters come from styling. Every styled letter
            costs two against the limit even though it looks like one.
          </p>
        )}
        <div className="grid grid-cols-4 gap-3 pt-1">
          <Stat label="Words" value={counts.words} />
          <Stat label="Lines" value={counts.lines} />
          <Stat label="Styled" value={`${Math.round(ratio * 100)}%`} />
          <Stat label="Emoji" value={emoji} />
        </div>
      </div>

      <div className="space-y-2">
        {findings.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 p-3">
            <p className="text-sm text-emerald-900 dark:text-emerald-200">
              Nothing to flag. Length, styling, structure and links all look right for the feed.
            </p>
          </div>
        ) : (
          findings.map((f) => {
            const s = SEVERITY[f.severity];
            return (
              <div key={f.id} className={`rounded-lg border p-3 ${s.box}`}>
                <div className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {f.title}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {f.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
