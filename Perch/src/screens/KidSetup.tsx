/**
 * KidSetup — consent-first onboarding for the protected phone.
 * Perch is transparent by design: the person using this phone sees exactly
 * what is monitored and what leaves the device, BEFORE it turns on.
 */

import { useState } from 'react';
import { usePerch } from '../store';
import { claimPairing } from '../lib/relay';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { configureWatcher, isNativeAndroid, openWatcherSettings, watcherEnabled } from '../lib/native';
import { WATCHED_APPS } from '../detection/engine';
import { OwlLogo } from '../components/OwlLogo';
import { Btn, Chip, Glass } from '../components/ui';

const APP_LABELS = [...new Set(Object.values(WATCHED_APPS))];

export function KidSetup() {
  const { setPairing, setLinked } = usePerch();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [accessOn, setAccessOn] = useState(false);

  async function onClaim() {
    setError('');
    setClaiming(true);
    const pairingId = await claimPairing(code);
    setClaiming(false);
    if (!pairingId) {
      setError("That code didn't work — check it with your parent and try again.");
      return;
    }
    setPairing(pairingId, null);
    await configureWatcher(pairingId, SUPABASE_URL, SUPABASE_ANON_KEY);
    setStep(3);
  }

  async function checkAccess() {
    const on = await watcherEnabled();
    setAccessOn(on);
    if (on) {
      const { pairingId } = usePerch.getState();
      if (pairingId) await configureWatcher(pairingId, SUPABASE_URL, SUPABASE_ANON_KEY);
      setLinked(true);
    }
  }

  return (
    <div className="scroll-y flex-1 px-5 pb-4">
      <div className="flex flex-col items-center pt-8 text-center">
        <OwlLogo size={72} />
        <h1 className="mt-2 text-2xl font-extrabold" style={{ color: 'var(--accent)' }}>
          {step === 1 ? 'Before we start' : step === 2 ? 'Enter your code' : 'One last thing'}
        </h1>
      </div>

      {step === 1 && (
        <>
          <Glass className="rise mt-5 p-5">
            <p className="text-[14px] font-bold">Perch never hides. Here's the whole deal:</p>
            <ul className="mt-3 flex flex-col gap-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--dim)' }}>
              <li>👀 Perch reads <b style={{ color: 'var(--text)' }}>notifications</b> from messaging apps on this phone and checks them for dangerous stuff — scams, creeps, threats.</li>
              <li>📵 Your messages <b style={{ color: 'var(--text)' }}>stay on this phone</b>. Nobody — including your parent — can read them through Perch.</li>
              <li>🚩 If something dangerous shows up, your parent gets a flag saying <b style={{ color: 'var(--text)' }}>why</b> — never the message itself.</li>
              <li>🔎 You can open Perch anytime and see everything it has ever flagged. Same list your parent sees.</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {APP_LABELS.map(a => <Chip key={a}>{a}</Chip>)}
            </div>
          </Glass>
          <Btn className="mt-4 w-full" onClick={() => setStep(2)}>Got it — continue</Btn>
        </>
      )}

      {step === 2 && (
        <>
          <p className="mt-4 text-center text-[13px]" style={{ color: 'var(--dim)' }}>
            Your parent has a 6-character code on their Perch app.
          </p>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            autoCapitalize="characters"
            className="mt-4 w-full rounded-2xl px-4 py-4 text-center text-2xl font-extrabold tracking-[.35em] outline-none"
            style={{ background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--accent)' }}
          />
          <Btn className="mt-3 w-full" onClick={onClaim} disabled={claiming || code.length < 6}>
            {claiming ? 'Linking…' : 'Link this phone'}
          </Btn>
          {error && <p className="mt-2 text-center text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
        </>
      )}

      {step === 3 && (
        <>
          {isNativeAndroid() ? (
            <Glass className="rise mt-5 p-5">
              <p className="text-[14px] font-bold">Give Perch notification access</p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--dim)' }}>
                Android will show a list — find <b style={{ color: 'var(--text)' }}>Perch</b> and switch it on.
                This is what lets the owl see incoming notifications to scan them.
              </p>
              <Btn className="mt-4 w-full" onClick={openWatcherSettings}>Open Android settings</Btn>
              <Btn kind="ghost" className="mt-2 w-full" onClick={checkAccess}>
                {accessOn ? '✓ Access granted' : "I've turned it on — check"}
              </Btn>
            </Glass>
          ) : (
            <Glass className="rise mt-5 p-5">
              <p className="text-[14px] font-bold">You're linked — but this is the web version</p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--dim)' }}>
                Real notification scanning needs the Perch Android app. On web you
                can still use the Shield test to send real flags to the linked parent.
              </p>
              <Btn className="mt-4 w-full" onClick={() => setLinked(true)}>Continue anyway</Btn>
            </Glass>
          )}
        </>
      )}
    </div>
  );
}
