import { useState } from 'react';
import { usePerch } from '../store';
import { providerLabel, proxyUsesLeft, proxyAvailable } from '../ai/cloud';
import { Btn, Glass, SectionTitle } from '../components/ui';

export function Settings() {
  const { kidAlias, apiKey, demo } = usePerch();
  const { setKidAlias, setApiKey, reset, clearChat } = usePerch();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="scroll-y flex-1 px-4 pb-2">
      <header className="pb-1 pt-5">
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--accent)' }}>Settings</h1>
      </header>

      <SectionTitle>Protected phone</SectionTitle>
      <Glass className="p-4">
        <label className="text-[12px] font-semibold" style={{ color: 'var(--dim)' }}>Kid's name</label>
        <input
          value={kidAlias}
          onChange={e => setKidAlias(e.target.value)}
          className="mt-1.5 w-full rounded-2xl px-4 py-3 text-[15px] outline-none"
          style={{ background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--text)' }}
        />
      </Glass>

      <SectionTitle>AI</SectionTitle>
      <Glass className="p-4">
        <p className="text-[13px] font-semibold">{providerLabel(apiKey)}</p>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--dim)' }}>
          {apiKey
            ? 'Using your own key for Ask Perch.'
            : proxyAvailable()
              ? `Free managed AI — ${proxyUsesLeft()} answers left on this device. Paste your own Gemini (AIza…) or Claude (sk-ant-…) key for unlimited use, or Perch falls back to fully on-device answers.`
              : 'Answers run fully on-device.'}
        </p>
        <input
          value={apiKey}
          onChange={e => setApiKey(e.target.value.trim())}
          placeholder="Paste a Gemini or Claude API key (optional)"
          className="mt-3 w-full rounded-2xl px-4 py-3 text-[13px] outline-none"
          style={{ background: 'var(--glass)', border: '1px solid var(--line)', color: 'var(--text)' }}
        />
      </Glass>

      <SectionTitle>Privacy — how Perch works</SectionTitle>
      <Glass className="p-4">
        <ul className="flex flex-col gap-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--dim)' }}>
          <li>🦉 Scanning happens <b style={{ color: 'var(--text)' }}>on the protected phone itself</b>, even offline.</li>
          <li>🚫 Message content <b style={{ color: 'var(--text)' }}>never leaves that phone</b> — not to us, not to anyone.</li>
          <li>🏷️ Only a flag crosses the wire: category, reason, app, sender name, time.</li>
          <li>👀 The kid can always open Perch on their phone and see exactly what's monitored — no spying, no secrets.</li>
        </ul>
      </Glass>

      <SectionTitle>Danger zone</SectionTitle>
      <Glass className="p-4">
        <Btn kind="ghost" className="w-full" onClick={clearChat}>Clear chat history</Btn>
        {!confirmReset ? (
          <Btn kind="danger" className="mt-2 w-full" onClick={() => setConfirmReset(true)}>
            {demo ? 'Exit demo' : 'Unlink & reset Perch'}
          </Btn>
        ) : (
          <div className="mt-2 flex gap-2">
            <Btn kind="danger" className="flex-1" onClick={reset}>Yes, reset everything</Btn>
            <Btn kind="ghost" className="flex-1" onClick={() => setConfirmReset(false)}>Cancel</Btn>
          </div>
        )}
      </Glass>

      <p className="py-4 text-center text-[10px]" style={{ color: 'var(--dim)' }}>
        Perch by Martian Coders · build {__BUILD_STAMP__}
      </p>
    </div>
  );
}
