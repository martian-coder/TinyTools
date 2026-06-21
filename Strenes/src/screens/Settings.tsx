import { useState } from 'react';
import { AlertTriangle, Briefcase, Forward, ShieldCheck, RotateCcw, Palette, Download, Brain, Trash2, Clock, Zap, Flame, Sparkles, KeyRound, Eye, EyeOff, MessageSquare } from 'lucide-react';
import { useSiftStore } from '../store';
import { Switch } from '../components/ui/Switch';
import { Segment } from '../components/ui/Segment';
import { Avatar } from '../components/ui/Avatar';

interface SettingsProps {
  onShowThemes: () => void;
}

export function Settings({ onShowThemes }: SettingsProps) {
  const settings              = useSiftStore(s => s.settings);
  const contacts              = useSiftStore(s => s.contacts);
  const updateCivility        = useSiftStore(s => s.updateCivility);
  const updateSpam            = useSiftStore(s => s.updateSpam);
  const updateBusiness        = useSiftStore(s => s.updateBusiness);
  const toggleTrusted         = useSiftStore(s => s.toggleTrusted);
  const updateDND             = useSiftStore(s => s.updateDND);
  const updateDrunkMode       = useSiftStore(s => s.updateDrunkMode);
  const updateDisappearingMessages = useSiftStore(s => s.updateDisappearingMessages);
  const updateUnhingedMode    = useSiftStore(s => s.updateUnhingedMode);
  const updateToneChecker     = useSiftStore(s => s.updateToneChecker);
  const updateSpellCheck      = useSiftStore(s => s.updateSpellCheck);
  const updateAiReplies       = useSiftStore(s => s.updateAiReplies);
  const updateSmsFallback     = useSiftStore(s => s.updateSmsFallback);
  const setContactEmergency   = useSiftStore(s => s.setContactEmergency);
  const resetToSeed           = useSiftStore(s => s.resetToSeed);
  const s = settings;
  const [showKey, setShowKey] = useState(false);

  return (
    <>
      <div className="glass-h px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center"
            style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(135deg,var(--accent),var(--accent2))', boxShadow: '0 6px 18px -6px var(--accent)' }}>
            <ShieldCheck size={18} color="#fff" />
          </div>
          <div>
            <div className="font-semibold text-main leading-tight tracking-tight">Settings</div>
            <div className="text-[11px] dim leading-tight">you're in control of the filter</div>
          </div>
        </div>
        <button onClick={onShowThemes} className="glass grid place-items-center" style={{ width: 34, height: 34, borderRadius: 11 }}>
          <Palette size={16} className="text-main" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-28 no-bar space-y-3 pt-1">

        {/* Civility */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <AlertTriangle size={16} className="cat-ic-rose" /> Civility filter
            </div>
            <Switch on={s.civility.enabled} onClick={() => updateCivility({ enabled: !s.civility.enabled })} />
          </div>
          {s.civility.enabled && (
            <>
              <div>
                <div className="text-xs dim mb-1.5">Sensitivity</div>
                <Segment
                  value={s.civility.sensitivity}
                  options={[{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }]}
                  onChange={v => updateCivility({ sensitivity: v as 'low' | 'medium' | 'high' })}
                />
              </div>
              <div>
                <div className="text-xs dim mb-1.5">When a message is flagged</div>
                <Segment
                  value={s.civility.onBlock}
                  options={[{ v: 'review', l: 'Review' }, { v: 'askPerMessage', l: 'Ask each' }, { v: 'silentDrop', l: 'Drop' }]}
                  onChange={v => updateCivility({ onBlock: v as 'review' | 'askPerMessage' | 'silentDrop' })}
                />
              </div>
              <label className="flex items-center justify-between text-sm text-main pt-0.5">
                <span>Tell the sender it was blocked</span>
                <Switch on={s.civility.notifySender} onClick={() => updateCivility({ notifySender: !s.civility.notifySender })} />
              </label>
            </>
          )}
        </div>

        {/* Business */}
        <div className="glass p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Briefcase size={16} className="cat-ic-sky" /> Business sorting
            </div>
            <Switch on={s.business.enabled} onClick={() => updateBusiness({ enabled: !s.business.enabled })} />
          </div>
          <p className="text-xs dim mt-1.5">Orders, deliveries and receipts get their own folder.</p>
        </div>

        {/* Spam */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Forward size={16} className="cat-ic-amber" /> Spam &amp; forwards
            </div>
            <Switch on={s.spam.enabled} onClick={() => updateSpam({ enabled: !s.spam.enabled })} />
          </div>
          {s.spam.enabled && (
            <div>
              <div className="text-xs dim mb-1.5">When junk is detected</div>
              <Segment
                value={s.spam.onBlock}
                options={[{ v: 'review', l: 'Review' }, { v: 'silentDrop', l: 'Drop' }]}
                onChange={v => updateSpam({ onBlock: v as 'review' | 'silentDrop' })}
              />
            </div>
          )}
        </div>

        {/* Disappearing Messages */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Trash2 size={16} className="cat-ic-amber" /> Disappearing Messages
            </div>
            <Switch on={s.disappearingMessages.enabled} onClick={() => updateDisappearingMessages({ enabled: !s.disappearingMessages.enabled })} />
          </div>
          {s.disappearingMessages.enabled && (
            <div>
              <div className="text-xs dim mb-1.5">When messages auto-delete</div>
              <Segment
                value={s.disappearingMessages.defaultMode}
                options={[{ v: 'off', l: 'Off' }, { v: 'onRead', l: 'On read' }, { v: '1m', l: '1m' }, { v: '5m', l: '5m' }, { v: '1h', l: '1h' }, { v: '24h', l: '24h' }]}
                onChange={v => updateDisappearingMessages({ defaultMode: v as any })}
              />
            </div>
          )}
        </div>

        {/* Do Not Disturb */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Clock size={16} className="cat-ic-sky" /> Do Not Disturb
            </div>
            <Switch on={s.dnd.enabled} onClick={() => updateDND({ enabled: !s.dnd.enabled })} />
          </div>
          {s.dnd.enabled && (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-xs dim block mb-1">Start hour</label>
                  <input type="number" min="0" max="23" value={s.dnd.startHour} onChange={e => updateDND({ startHour: parseInt(e.target.value) })} className="w-full glass px-3 py-2 text-sm text-main rounded-lg" />
                </div>
                <div className="flex-1">
                  <label className="text-xs dim block mb-1">End hour</label>
                  <input type="number" min="0" max="23" value={s.dnd.endHour} onChange={e => updateDND({ endHour: parseInt(e.target.value) })} className="w-full glass px-3 py-2 text-sm text-main rounded-lg" />
                </div>
              </div>
              <label className="flex items-center justify-between text-sm text-main">
                <span>Allow trusted contacts</span>
                <Switch on={s.dnd.allowTrusted} onClick={() => updateDND({ allowTrusted: !s.dnd.allowTrusted })} />
              </label>
              <label className="flex items-center justify-between text-sm text-main">
                <span>Allow emergency contacts</span>
                <Switch on={s.dnd.allowEmergency} onClick={() => updateDND({ allowEmergency: !s.dnd.allowEmergency })} />
              </label>
              <label className="flex items-center justify-between text-sm text-main">
                <span>Notify but silent</span>
                <Switch on={s.dnd.notifyButSilent} onClick={() => updateDND({ notifyButSilent: !s.dnd.notifyButSilent })} />
              </label>
            </div>
          )}
        </div>

        {/* Drunk Mode */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Zap size={16} className="cat-ic-rose" /> Drunk Mode
            </div>
            <Switch on={s.drunkMode.enabled} onClick={() => updateDrunkMode({ enabled: !s.drunkMode.enabled })} />
          </div>
          {s.drunkMode.enabled && (
            <>
              <label className="flex items-center justify-between text-sm text-main">
                <span>Auto-detect from typing</span>
                <Switch on={s.drunkMode.autoDetect} onClick={() => updateDrunkMode({ autoDetect: !s.drunkMode.autoDetect })} />
              </label>
              <div>
                <div className="text-xs dim mb-1.5">When drunk detected</div>
                <Segment
                  value={s.drunkMode.action}
                  options={[{ v: 'warn', l: 'Warn' }, { v: 'prevent', l: 'Prevent' }]}
                  onChange={v => updateDrunkMode({ action: v as 'warn' | 'prevent' })}
                />
              </div>
            </>
          )}
        </div>

        {/* Unhinged Mode */}
        <div className="glass p-4 space-y-2" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Flame size={16} className="cat-ic-rose" /> Unhinged Mode
            </div>
            <Switch on={s.unhingedMode.enabled} onClick={() => updateUnhingedMode({ enabled: !s.unhingedMode.enabled })} />
          </div>
          <p className="text-xs dim">Go wild. Bypass all filters & moderation. For when you wanna troll yourself 😈</p>
        </div>

        {/* Tone Checker */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Brain size={16} className="text-[#7c83ff]" /> Tone Checker
            </div>
            <Switch on={s.toneChecker.enabled} onClick={() => updateToneChecker({ enabled: !s.toneChecker.enabled })} />
          </div>
          {s.toneChecker.enabled && (
            <>
              <label className="flex items-center justify-between text-sm text-main">
                <span>Warn on aggressive tone</span>
                <Switch on={s.toneChecker.warnOnAggressive} onClick={() => updateToneChecker({ warnOnAggressive: !s.toneChecker.warnOnAggressive })} />
              </label>
              <p className="text-xs dim">AI analyzes if your message sounds polite, assertive, or aggressive before sending.</p>
            </>
          )}
        </div>

        {/* Spell Check */}
        <div className="glass p-4 space-y-2" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Sparkles size={16} className="cat-ic-amber" /> Style-Aware Spell Check
            </div>
            <Switch on={s.spellCheck.enabled} onClick={() => updateSpellCheck({ enabled: !s.spellCheck.enabled })} />
          </div>
          <p className="text-xs dim">Detects typos & suggests corrections in your style. "ubcan" → "bro can" 🎯</p>
        </div>

        {/* AI Reply Suggestions */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Sparkles size={16} style={{ color: 'var(--accent2)' }} /> AI Reply Suggestions
            </div>
            <Switch on={s.aiReplies?.enabled ?? false} onClick={() => updateAiReplies({ enabled: !(s.aiReplies?.enabled ?? false) })} />
          </div>
          {s.aiReplies?.enabled && (
            <>
              <p className="text-xs dim">Shows 3 short reply options when you open a chat. Works on-device (Gemini Nano) or with your Claude API key for higher quality.</p>
              <div>
                <div className="text-xs dim mb-1.5 flex items-center gap-1.5">
                  <KeyRound size={11} /> Claude API key <span className="opacity-60">(optional)</span>
                </div>
                <div className="flex gap-2 items-center glass rounded-xl px-3 py-2" style={{ borderRadius: 14 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={s.aiReplies?.anthropicKey ?? ''}
                    onChange={e => updateAiReplies({ anthropicKey: e.target.value })}
                    placeholder="sk-ant-..."
                    className="flex-1 bg-transparent text-sm text-main outline-none placeholder:dim min-w-0"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button onClick={() => setShowKey(v => !v)} style={{ color: 'var(--dim)', flexShrink: 0 }}>
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: s.aiReplies.anthropicKey ? 'var(--accent)' : 'var(--accent2)' }}
                />
                <span className="dim">
                  {s.aiReplies.anthropicKey ? 'Using Claude API — best quality' : 'Using on-device AI (Gemini Nano) — no key needed'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* SMS Fallback */}
        <div className="glass p-4 space-y-2" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <MessageSquare size={16} style={{ color: '#22d3ee' }} /> SMS Fallback
            </div>
            <Switch on={s.smsFallback?.enabled ?? false} onClick={() => updateSmsFallback({ enabled: !(s.smsFallback?.enabled ?? false) })} />
          </div>
          <p className="text-xs dim">When internet is down, offer to send messages via SMS. You'll be asked for consent every time — standard carrier rates may apply.</p>
        </div>

        {/* Trusted contacts */}
        <div className="glass p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center gap-2 font-medium text-main mb-1">
            <ShieldCheck size={16} className="cat-ic-emerald" /> Trusted contacts
          </div>
          <p className="text-xs dim mb-2">Trusted people bypass every filter.</p>
          {contacts.map(c => (
            <div key={c.id} className="space-y-1.5">
              <label className="flex items-center justify-between py-1.5">
                <span className="flex items-center gap-2 text-sm text-main">
                  <Avatar name={c.name} grad={c.grad} size={28} />
                  {c.name}
                </span>
                <Switch on={c.trusted} onClick={() => toggleTrusted(c.id)} />
              </label>
              {c.trusted && (
                <label className="flex items-center justify-between text-xs text-main pl-10">
                  <span>Emergency contact</span>
                  <Switch on={c.isEmergency ?? false} onClick={() => setContactEmergency(c.id, !(c.isEmergency ?? false))} />
                </label>
              )}
            </div>
          ))}
        </div>

        {/* Engine Status */}
        <div className="glass p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center gap-2 font-medium text-main mb-2">
            <Brain size={16} className="text-[#7c83ff]" /> Moderation Engine
          </div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="dim">Primary:</span>
              <span className="text-main font-medium">Gemini Nano (On-device)</span>
            </div>
            <div className="flex justify-between">
              <span className="dim">Fallback:</span>
              <span className="text-main font-medium">Rules engine</span>
            </div>
            <p className="dim pt-1">💡 Message plaintext never leaves your device.</p>
          </div>
        </div>

        {/* Data Management */}
        <div className="glass p-4 space-y-2" style={{ borderRadius: 20 }}>
          <div className="flex items-center gap-2 font-medium text-main mb-2">
            <Download size={16} className="text-[#22d3ee]" /> Data Management
          </div>
          <button
            onClick={() => {
              const data = JSON.stringify({
                contacts: useSiftStore.getState().contacts,
                settings: useSiftStore.getState().settings,
                messages: useSiftStore.getState().messages,
                exportedAt: new Date().toISOString(),
              }, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sift-backup-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="w-full flex items-center justify-center gap-2 text-sm text-main py-2 glass hover:bg-white hover:bg-opacity-10 transition"
            style={{ borderRadius: 12 }}
          >
            <Download size={14} /> Export data
          </button>
        </div>

        <button
          onClick={resetToSeed}
          className="w-full flex items-center justify-center gap-2 text-sm dim py-3"
        >
          <RotateCcw size={14} /> Reset demo
        </button>
      </div>
    </>
  );
}
