import { useEffect, useState } from 'react';
import { usePerch } from '../store';
import { createPairing, fetchEvents, pairingClaimed } from '../lib/relay';
import { backendConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { briefing } from '../ai/analyst';
import { instantAlertsRunning, isNativeAndroid, startInstantAlerts, stopInstantAlerts } from '../lib/native';
import { EventCard } from '../components/EventCard';
import { OwlLogo } from '../components/OwlLogo';
import { Btn, Glass, SectionTitle } from '../components/ui';

export function ParentHome() {
  const { demo, kidAlias, pairingId, pendingCode, linked, events } = usePerch();
  const { setKidAlias, setPairing, setLinked, addEvents, setLastSync } = usePerch();
  const [nameDraft, setNameDraft] = useState(kidAlias);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [alertsOn, setAlertsOn] = useState(false);

  // Reflect whether the instant-alerts service is armed on this phone.
  useEffect(() => {
    if (demo || !linked) return;
    instantAlertsRunning().then(setAlertsOn);
  }, [demo, linked]);

  async function toggleAlerts() {
    if (!pairingId) return;
    if (alertsOn) {
      await stopInstantAlerts();
      setAlertsOn(false);
    } else {
      const ok = await startInstantAlerts(pairingId, SUPABASE_URL, SUPABASE_ANON_KEY, kidAlias);
      setAlertsOn(ok);
    }
  }

  // Poll: while waiting for the kid's phone to claim the code.
  useEffect(() => {
    if (demo || !pairingId || linked) return;
    const t = setInterval(async () => {
      if (await pairingClaimed(pairingId)) setLinked(true);
    }, 5000);
    return () => clearInterval(t);
  }, [demo, pairingId, linked, setLinked]);

  // Poll: fresh events while the app is open.
  useEffect(() => {
    if (demo || !pairingId || !linked) return;
    let stop = false;
    const pull = async () => {
      const since = usePerch.getState().events[0]?.at ?? 0;
      const fresh = await fetchEvents(pairingId, since);
      if (!stop && fresh.length) addEvents(fresh);
      if (!stop) setLastSync(Date.now());
    };
    pull();
    const t = setInterval(pull, 20_000);
    return () => { stop = true; clearInterval(t); };
  }, [demo, pairingId, linked, addEvents, setLastSync]);

  async function onCreate() {
    setError('');
    if (!backendConfigured()) { setError('Backend not configured in this build.'); return; }
    setCreating(true);
    const p = await createPairing(nameDraft.trim() || 'my kid');
    setCreating(false);
    if (!p) { setError("Couldn't create a pairing code — check your connection and that the Perch migration has been run."); return; }
    setKidAlias(nameDraft.trim() || 'my kid');
    setPairing(p.pairingId, p.code);
  }

  const alerts = events.filter(e => e.severity === 'alert');

  return (
    <div className="scroll-y flex-1 px-4 pb-2">
      <header className="flex items-center gap-3 pb-1 pt-5">
        <OwlLogo size={44} />
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: 'var(--accent)' }}>Perch</h1>
          <p className="text-[11px]" style={{ color: 'var(--dim)' }}>
            {demo ? 'Demo — sample data' : linked ? `watching over ${kidAlias}'s phone` : 'not linked yet'}
          </p>
        </div>
      </header>

      {/* ── Not paired yet: create the code ── */}
      {!demo && !pairingId && (
        <Glass className="rise mt-4 p-5">
          <h2 className="text-[16px] font-bold">Link your kid's phone</h2>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--dim)' }}>
            Perch will give you a one-time code. Install Perch on their phone,
            choose “Protect this phone”, and type the code in — that's it.
          </p>
          <input
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            placeholder="Kid's name (e.g. Aryan)"
            className="mt-4 w-full rounded-2xl px-4 py-3 text-[15px] outline-none"
            style={{ background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--text)' }}
          />
          <Btn className="mt-3 w-full" onClick={onCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create pairing code'}
          </Btn>
          {error && <p className="mt-2 text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
        </Glass>
      )}

      {/* ── Waiting for the kid's phone ── */}
      {!demo && pairingId && !linked && (
        <Glass className="rise mt-4 p-5 text-center">
          <p className="text-[13px]" style={{ color: 'var(--dim)' }}>
            On {kidAlias}'s phone, open Perch → “Protect this phone” and enter:
          </p>
          <div className="my-4 text-4xl font-extrabold tracking-[.3em]" style={{ color: 'var(--accent)' }}>
            {pendingCode}
          </div>
          <p className="pulse-soft text-[12px]" style={{ color: 'var(--dim)' }}>waiting for {kidAlias}'s phone…</p>
          <Btn kind="ghost" className="mt-4 w-full" onClick={() => setPairing(null, null)}>Start over</Btn>
        </Glass>
      )}

      {/* ── Linked: the nest ── */}
      {(demo || linked) && (
        <>
          {!demo && (
            <Glass className="mt-3 p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔔</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">Instant alerts</p>
                  <p className="text-[12px] leading-snug" style={{ color: 'var(--dim)' }}>
                    {isNativeAndroid()
                      ? alertsOn
                        ? 'On — you\'ll get a notification within a minute of any flag, even with Perch closed.'
                        : 'Get a phone notification the moment a flag arrives, even when Perch is closed.'
                      : 'Available in the Perch Android app — on web, flags sync while this page is open.'}
                  </p>
                </div>
                {isNativeAndroid() && (
                  <button
                    onClick={toggleAlerts}
                    aria-label="Toggle instant alerts"
                    className="relative h-7 w-12 shrink-0 rounded-full transition"
                    style={{ background: alertsOn ? 'var(--accent)' : 'var(--glass2)', border: '1px solid var(--line)' }}
                  >
                    <span
                      className="absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white transition-all"
                      style={{ left: alertsOn ? 24 : 2 }}
                    />
                  </button>
                )}
              </div>
            </Glass>
          )}

          <SectionTitle>This week</SectionTitle>
          <Glass className="p-4">
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{briefing(events, kidAlias)}</p>
          </Glass>

          {alerts.length > 0 && (
            <>
              <SectionTitle>Serious flags</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {alerts.map(e => <EventCard key={e.id} e={e} />)}
              </div>
            </>
          )}

          <SectionTitle>Everything flagged</SectionTitle>
          {events.length === 0 ? (
            <Glass className="p-5 text-center">
              <p className="text-[13px]" style={{ color: 'var(--dim)' }}>
                Nothing yet. Quiet nights are good nights. 🦉
              </p>
            </Glass>
          ) : (
            <div className="flex flex-col gap-2.5 pb-3">
              {events.map(e => <EventCard key={e.id} e={e} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
