import { AlertTriangle, Briefcase, Forward, ShieldCheck, RotateCcw, Palette } from 'lucide-react';
import { useSiftStore } from '../store';
import { Switch } from '../components/ui/Switch';
import { Segment } from '../components/ui/Segment';
import { Avatar } from '../components/ui/Avatar';

interface SettingsProps {
  onShowThemes: () => void;
}

export function Settings({ onShowThemes }: SettingsProps) {
  const settings      = useSiftStore(s => s.settings);
  const contacts      = useSiftStore(s => s.contacts);
  const updateCivility = useSiftStore(s => s.updateCivility);
  const updateSpam     = useSiftStore(s => s.updateSpam);
  const updateBusiness = useSiftStore(s => s.updateBusiness);
  const toggleTrusted  = useSiftStore(s => s.toggleTrusted);
  const resetToSeed    = useSiftStore(s => s.resetToSeed);
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

        {/* Trusted contacts */}
        <div className="glass p-4" style={{ borderRadius: 20 }}>
          <div className="flex items-center gap-2 font-medium text-main mb-1">
            <ShieldCheck size={16} className="cat-ic-emerald" /> Trusted contacts
          </div>
          <p className="text-xs dim mb-2">Trusted people bypass every filter.</p>
          {contacts.map(c => (
            <label key={c.id} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-2 text-sm text-main">
                <Avatar name={c.name} grad={c.grad} size={28} />
                {c.name}
              </span>
              <Switch on={c.trusted} onClick={() => toggleTrusted(c.id)} />
            </label>
          ))}
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
