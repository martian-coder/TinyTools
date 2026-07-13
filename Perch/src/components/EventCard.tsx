import type { PerchEvent } from '../types';
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '../detection/engine';
import { Glass } from './ui';

function timeAgo(at: number): string {
  const diff = Date.now() - at;
  if (diff < 3600_000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3600_000)}h ago`;
  const days = Math.round(diff / 86_400_000);
  if (days <= 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString();
}

export function EventCard({ e }: { e: PerchEvent }) {
  const isAlert = e.severity === 'alert';
  return (
    <Glass className="rise p-4">
      <div className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
          style={{
            background: isAlert ? 'rgba(251,113,133,.14)' : 'rgba(251,191,36,.12)',
            border: `1px solid ${isAlert ? 'rgba(251,113,133,.4)' : 'rgba(251,191,36,.3)'}`,
          }}
        >
          {CATEGORY_EMOJI[e.category]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-[14px]" style={{ color: isAlert ? 'var(--danger)' : 'var(--warn)' }}>
              {CATEGORY_LABELS[e.category]}
            </span>
            <span className="shrink-0 text-[11px]" style={{ color: 'var(--dim)' }}>{timeAgo(e.at)}</span>
          </div>
          <div className="mt-0.5 truncate text-[13px]" style={{ color: 'var(--text)' }}>
            from <b>{e.sender}</b> on {e.app}
          </div>
          <div className="mt-1 text-[12.5px] leading-snug" style={{ color: 'var(--dim)' }}>{e.reason}</div>
        </div>
      </div>
    </Glass>
  );
}
