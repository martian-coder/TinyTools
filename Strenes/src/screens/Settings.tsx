import { AlertTriangle, Briefcase, Forward, ShieldCheck, RotateCcw, Palette, Clock, Zap, Trash2, Flame, Brain } from 'lucide-react';
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
  const setContactEmergency   = useSiftStore(s => s.setContactEmergency);
  const resetToSeed           = useSiftStore(s => s.resetToSeed);
  const s = settings;

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

        {/* Trusted & Emergency contacts */}
        <div className="glass p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center gap-2 font-medium text-main mb-1">
            <ShieldCheck size={16} className="cat-ic-emerald" /> Trusted contacts
          </div>
          <p className="text-xs dim mb-2">Trusted people bypass every filter. Emergency contacts reach you even in DND.</p>
          {contacts.map(c => (
            <div key={c.id}>
              <label className="flex items-center justify-between py-1.5">
                <span className="flex items-center gap-2 text-sm text-main">
                  <Avatar name={c.name} grad={c.grad} size={28} />
                  <div>
                    <div>{c.name}</div>
                    {c.isEmergency && <div className="text-[10px] dim">🚨 Emergency</div>}
                  </div>
                </span>
                <Switch on={c.trusted} onClick={() => toggleTrusted(c.id)} />
              </label>
              {c.trusted && (
                <label className="flex items-center gap-2 ml-10 py-1 text-xs text-main">
                  <input
                    type="checkbox"
                    checked={c.isEmergency || false}
                    onChange={e => setContactEmergency(c.id, e.target.checked)}
                    className="w-4 h-4"
                  />
                  Emergency contact
                </label>
              )}
            </div>
          ))}
        </div>

        {/* Disappearing Messages */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Trash2 size={16} className="cat-ic-amber" /> Disappearing messages
            </div>
            <Switch on={s.disappearingMessages.enabled} onClick={() => updateDisappearingMessages({ enabled: !s.disappearingMessages.enabled })} />
          </div>
          {s.disappearingMessages.enabled && (
            <>
              <div>
                <div className="text-xs dim mb-1.5">Default timer</div>
                <Segment
                  value={s.disappearingMessages.defaultMode}
                  options={[
                    { v: 'off', l: 'Off' },
                    { v: 'onRead', l: 'On read' },
                    { v: '1m', l: '1m' },
                    { v: '5m', l: '5m' },
                    { v: '1h', l: '1h' },
                    { v: '24h', l: '24h' }
                  ]}
                  onChange={v => updateDisappearingMessages({ defaultMode: v as any })}
                />
              </div>
            </>
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
            <>
              <div className="space-y-2">
                <div className="text-xs dim">Quiet hours</div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={s.dnd.startHour}
                    onChange={e => updateDND({ startHour: parseInt(e.target.value) })}
                    className="w-16 glass2 px-2 py-1 text-sm text-main rounded"
                  />
                  <span className="dim text-sm">to</span>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={s.dnd.endHour}
                    onChange={e => updateDND({ endHour: parseInt(e.target.value) })}
                    className="w-16 glass2 px-2 py-1 text-sm text-main rounded"
                  />
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
                <span>Mute notifications (show msgs)</span>
                <Switch on={s.dnd.notifyButSilent} onClick={() => updateDND({ notifyButSilent: !s.dnd.notifyButSilent })} />
              </label>
            </>
          )}
        </div>

        {/* Drunk Mode */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Zap size={16} className="cat-ic-rose" /> Drunk mode
            </div>
            <Switch on={s.drunkMode.enabled} onClick={() => updateDrunkMode({ enabled: !s.drunkMode.enabled })} />
          </div>
          {(s.drunkMode.enabled || s.drunkMode.autoDetect) && (
            <>
              <label className="flex items-center justify-between text-sm text-main">
                <span>AI auto-detect suspicious typing</span>
                <Switch on={s.drunkMode.autoDetect} onClick={() => updateDrunkMode({ autoDetect: !s.drunkMode.autoDetect })} />
              </label>
              {(s.drunkMode.enabled || s.drunkMode.autoDetect) && (
                <div>
                  <div className="text-xs dim mb-1.5">When detected</div>
                  <Segment
                    value={s.drunkMode.action}
                    options={[{ v: 'warn', l: 'Warn' }, { v: 'prevent', l: 'Prevent' }]}
                    onChange={v => updateDrunkMode({ action: v as 'warn' | 'prevent' })}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Unhinged Mode */}
        <div className="glass p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Flame size={16} style={{ color: '#f59e0b' }} /> Unhinged mode
            </div>
            <Switch on={s.unhingedMode.enabled} onClick={() => updateUnhingedMode({ enabled: !s.unhingedMode.enabled })} />
          </div>
          <p className="text-xs dim mt-1.5">Go wild. Bypass all filters & moderation. For when you wanna troll yourself 😈</p>
        </div>

        {/* Tone Checker */}
        <div className="glass p-4 space-y-3" style={{ borderRadius: 20 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-main">
              <Brain size={16} style={{ color: '#8b5cf6' }} /> Message tone checker
            </div>
            <Switch on={s.toneChecker.enabled} onClick={() => updateToneChecker({ enabled: !s.toneChecker.enabled })} />
          </div>
          <p className="text-xs dim mt-1.5">AI analyzes if your message sounds polite, assertive, or aggressive before sending.</p>
          {s.toneChecker.enabled && (
            <label className="flex items-center justify-between text-sm text-main">
              <span>Warn if message sounds aggressive</span>
              <Switch on={s.toneChecker.warnOnAggressive} onClick={() => updateToneChecker({ warnOnAggressive: !s.toneChecker.warnOnAggressive })} />
            </label>
          )}
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
