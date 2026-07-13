/**
 * KidHome — the transparency screen on the protected phone. The kid sees
 * the same flags the parent sees, live watcher status, and exactly what
 * leaves the device. Honesty is the feature.
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { isNativeAndroid, openWatcherSettings, watcherEnabled, watcherLocalEvents, watcherStats, type WatcherStats } from '../lib/native';
import { WATCHED_APPS } from '../detection/engine';
import { EventCard } from '../components/EventCard';
import { OwlLogo } from '../components/OwlLogo';
import { Btn, Chip, Glass, SectionTitle } from '../components/ui';
import { Shield } from './Shield';
import type { PerchEvent } from '../types';

const APP_LABELS = [...new Set(Object.values(WATCHED_APPS))];

export function KidHome() {
  const [view, setView] = useState<'status' | 'shield'>('status');
  const [enabled, setEnabled] = useState(!isNativeAndroid());
  const [stats, setStats] = useState<WatcherStats>({ scannedToday: 0, flagged: 0 });
  const [localEvents, setLocalEvents] = useState<PerchEvent[]>([]);

  useEffect(() => {
    if (view !== 'status') return;
    let stop = false;
    const refresh = async () => {
      const [en, st, ev] = await Promise.all([watcherEnabled(), watcherStats(), watcherLocalEvents()]);
      if (stop) return;
      if (isNativeAndroid()) setEnabled(en);
      setStats(st);
      setLocalEvents(ev.sort((a, b) => b.at - a.at));
    };
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => { stop = true; clearInterval(t); };
  }, [view]);

  if (view === 'shield') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Shield />
        <div className="px-4 pb-4">
          <Btn kind="ghost" className="w-full" onClick={() => setView('status')}>← Back to status</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-y flex-1 px-4 pb-4">
      <header className="flex items-center gap-3 pb-1 pt-5">
        <OwlLogo size={44} />
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: 'var(--accent)' }}>Perch is on the branch</h1>
          <p className="text-[11px]" style={{ color: 'var(--dim)' }}>this phone is protected — and you can see everything</p>
        </div>
      </header>

      <Glass className="mt-3 p-4">
        <div className="flex items-center gap-3">
          {enabled
            ? <ShieldCheck size={28} style={{ color: 'var(--accent2)' }} />
            : <ShieldOff size={28} style={{ color: 'var(--danger)' }} />}
          <div className="flex-1">
            <p className="font-bold text-[14px]">{enabled ? 'Watching' : 'Notification access is off'}</p>
            <p className="text-[12px]" style={{ color: 'var(--dim)' }}>
              {enabled
                ? isNativeAndroid()
                  ? `${stats.scannedToday} notifications scanned today · ${stats.flagged} flags ever`
                  : 'web version — use the Shield test to try the engine'
                : 'Perch can\'t protect this phone until it\'s back on'}
            </p>
          </div>
        </div>
        {!enabled && isNativeAndroid() && (
          <Btn className="mt-3 w-full" onClick={openWatcherSettings}>Turn it back on</Btn>
        )}
      </Glass>

      <SectionTitle>Apps Perch watches</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {APP_LABELS.map(a => <Chip key={a}>{a}</Chip>)}
      </div>

      <SectionTitle>What ever leaves this phone</SectionTitle>
      <Glass className="p-4">
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--dim)' }}>
          Only flags: <b style={{ color: 'var(--text)' }}>category + reason + app + sender name + time</b>.
          Never a message. Never a photo. Nothing else — that's the whole list.
        </p>
      </Glass>

      <SectionTitle>Everything Perch has flagged here</SectionTitle>
      {localEvents.length === 0 ? (
        <Glass className="p-4 text-center">
          <p className="text-[13px]" style={{ color: 'var(--dim)' }}>Nothing flagged. 🦉</p>
        </Glass>
      ) : (
        <div className="flex flex-col gap-2.5">
          {localEvents.map(e => <EventCard key={e.id} e={e} />)}
        </div>
      )}

      <div className="pt-4">
        <Btn kind="ghost" className="w-full" onClick={() => setView('shield')}>🛡️ Test the shield</Btn>
      </div>
    </div>
  );
}
