import { useState } from 'react';
import { useSiftStore } from '../store';
import { Avatar } from './ui/Avatar';
import { CIRCLE_META, type Circle } from '../moderation/profiles';
import type { DisappearingMessageMode } from '../types';
import {
  X, Pencil, Check, MessageCircle, ShieldCheck, Ban, Trash2, Timer, Users2, ChevronRight, ChevronDown,
} from 'lucide-react';

const BLOCK_OPTIONS: { label: string; hours?: number }[] = [
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: 'Forever' },
];

const DISAPPEAR_OPTIONS: { label: string; mode: DisappearingMessageMode | undefined }[] = [
  { label: 'App default', mode: undefined },
  { label: 'Off', mode: 'off' },
  { label: '24 hours', mode: '24h' },
  { label: '7 days', mode: '7d' },
];
const disappearLabel = (mode: DisappearingMessageMode | undefined) =>
  DISAPPEAR_OPTIONS.find(o => o.mode === mode)?.label ?? 'App default';

function fmtRemaining(ts: number): string {
  const ms = ts - Date.now();
  if (ms <= 0) return 'expiring…';
  const hrs = Math.ceil(ms / 3_600_000);
  return hrs < 24 ? `${hrs}h left` : `${Math.ceil(hrs / 24)}d left`;
}

/** A round icon-button used for the three headline actions (Message/Trust/Block). */
function RoundAction({ icon, label, tint, onClick, onPointerDown }: {
  icon: React.ReactNode; label: string; tint: string;
  onClick: () => void; onPointerDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <button onClick={onClick} onPointerDown={onPointerDown} className="flex flex-col items-center gap-1.5">
      <span className="grid place-items-center" style={{ width: 52, height: 52, borderRadius: 999, background: `${tint}22`, color: tint }}>
        {icon}
      </span>
      <span className="text-[11px] font-medium text-main">{label}</span>
    </button>
  );
}

/** A single expandable settings row (Circle / Disappearing messages). */
function ExpandRow({ icon, label, value, open, onToggle, children }: {
  icon: React.ReactNode; label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--line)]">
      <button onClick={onToggle} className="w-full flex items-center gap-3 py-3.5">
        <span className="dim">{icon}</span>
        <span className="flex-1 text-left text-[15px] text-main">{label}</span>
        <span className="text-[13px] dim">{value}</span>
        {open ? <ChevronDown size={16} className="dim" /> : <ChevronRight size={16} className="dim" />}
      </button>
      {open && <div className="pb-3.5 -mt-1">{children}</div>}
    </div>
  );
}

/**
 * The ONE contact options sheet — openable from the inbox, Contacts, the
 * chat header, or Commander. Slides up like a native contact-info sheet
 * instead of floating as a centered dialog.
 */
export function ContactProfileModal({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const contact = useSiftStore(s => s.contacts.find(c => c.id === contactId));
  const upsertContact = useSiftStore(s => s.upsertContact);
  const toggleTrusted = useSiftStore(s => s.toggleTrusted);
  const setBlocked = useSiftStore(s => s.setBlocked);
  const setDisappearMode = useSiftStore(s => s.setDisappearMode);
  const setContactCircle = useSiftStore(s => s.setContactCircle);
  const removeContact = useSiftStore(s => s.removeContact);
  const openConversation = useSiftStore(s => s.openConversation);
  const setBanner = useSiftStore(s => s.setBanner);

  const [editingName, setEditingName] = useState(false);
  const [nameEdit, setNameEdit] = useState(contact?.name ?? '');
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [openRow, setOpenRow] = useState<'circle' | 'disappear' | null>(null);

  if (!contact) return null;

  const isBlocked = !!contact.blocked && (!contact.blockedUntil || contact.blockedUntil > Date.now());

  const saveName = () => {
    upsertContact({ id: contact.id, name: nameEdit.trim() || contact.name, phone: contact.phone });
    setEditingName(false);
    setBanner('✓ Name saved');
  };
  const saveNamePointerDown = (e: React.PointerEvent) => { e.preventDefault(); saveName(); };

  const block = (hours?: number) => {
    setBlocked(contact.id, true, hours ? Date.now() + hours * 3_600_000 : undefined);
    setShowBlockPicker(false);
    setBanner(hours ? `🚫 Blocked for ${hours < 24 ? hours + 'h' : hours / 24 + 'd'}` : '🚫 Blocked');
  };

  return (
    <div className="fixed inset-0 bg-black/55 flex items-end z-[60]" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl max-h-[88vh] overflow-y-auto no-bar slide-up"
        style={{ background: 'var(--base)', boxShadow: '0 -20px 60px -12px rgba(0,0,0,.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Grab handle + close */}
        <div className="flex items-center justify-center relative pt-2.5 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--line)' }} />
          <button onClick={onClose} className="absolute right-3 top-2 p-1.5 rounded-full hover:bg-[var(--surface-hover)]">
            <X size={18} className="dim" />
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col items-center gap-2 px-5 pb-5">
          <Avatar name={contact.name} grad={contact.grad} size={76} trusted={contact.trusted} />

          {editingName ? (
            <div className="flex items-center gap-2 w-full max-w-[280px] mt-1">
              <input
                autoFocus
                value={nameEdit}
                onChange={e => setNameEdit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="flex-1 text-center font-semibold text-lg text-main bg-transparent border-b border-[var(--accent)] py-1 focus:outline-none"
              />
              <button onClick={saveName} onPointerDown={saveNamePointerDown}
                className="grid place-items-center shrink-0" style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--accent)' }}>
                <Check size={15} color="#fff" />
              </button>
            </div>
          ) : (
            <button onClick={() => { setNameEdit(contact.name); setEditingName(true); }} className="flex items-center gap-1.5 mt-1">
              <span className="font-semibold text-lg text-main">{contact.name}</span>
              <Pencil size={13} className="dim" />
            </button>
          )}

          <div className="text-sm dim">{contact.phone || 'no number'}</div>
          {isBlocked && (
            <div className="text-xs text-amber-400 font-medium">
              🚫 Blocked{contact.blockedUntil ? ` · ${fmtRemaining(contact.blockedUntil)}` : ''}
            </div>
          )}
        </div>

        {/* Headline actions */}
        <div className="flex justify-center gap-8 px-5 pb-2">
          <RoundAction icon={<MessageCircle size={22} />} label="Message" tint="var(--accent)"
            onClick={() => { openConversation(contact.id); onClose(); }} />
          <RoundAction icon={<ShieldCheck size={22} />} label={contact.trusted ? 'Trusted' : 'Trust'}
            tint={contact.trusted ? '#34d399' : 'var(--accent2)'} onClick={() => toggleTrusted(contact.id)} />
          <RoundAction icon={<Ban size={22} />} label={isBlocked ? 'Unblock' : 'Block'} tint="#fbbf24"
            onClick={() => {
              if (isBlocked) { setBlocked(contact.id, false); setBanner('✓ Unblocked'); }
              else setShowBlockPicker(v => !v);
            }} />
        </div>

        {showBlockPicker && !isBlocked && (
          <div className="flex gap-2 px-5 pb-3">
            {BLOCK_OPTIONS.map(o => (
              <button key={o.label} onClick={() => block(o.hours)}
                className="flex-1 py-2 rounded-full text-xs font-medium text-center" style={{ background: 'var(--surface-hover)', color: 'var(--text)' }}>
                {o.label}
              </button>
            ))}
          </div>
        )}

        {/* Settings list */}
        <div className="px-5 pb-2">
          <ExpandRow
            icon={<Users2 size={18} />} label="Circle"
            value={contact.circle ? `${CIRCLE_META[contact.circle].emoji} ${CIRCLE_META[contact.circle].label}` : 'None'}
            open={openRow === 'circle'} onToggle={() => setOpenRow(o => o === 'circle' ? null : 'circle')}
          >
            <div className="flex flex-wrap gap-2">
              {(Object.entries(CIRCLE_META) as [Circle, typeof CIRCLE_META[Circle]][]).map(([id, meta]) => (
                <button
                  key={id}
                  onClick={() => setContactCircle(contact.id, contact.circle === id ? undefined : id)}
                  className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                  style={contact.circle === id
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--surface-hover)', color: 'var(--text)' }}
                >
                  {meta.emoji} {meta.label}
                </button>
              ))}
            </div>
          </ExpandRow>

          <ExpandRow
            icon={<Timer size={18} />} label="Disappearing messages"
            value={disappearLabel(contact.disappearMode)}
            open={openRow === 'disappear'} onToggle={() => setOpenRow(o => o === 'disappear' ? null : 'disappear')}
          >
            <div className="flex flex-wrap gap-2">
              {DISAPPEAR_OPTIONS.map(o => (
                <button key={o.label} onClick={() => setDisappearMode(contact.id, o.mode)}
                  className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                  style={contact.disappearMode === o.mode
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--surface-hover)', color: 'var(--text)' }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </ExpandRow>
        </div>

        {/* Danger zone */}
        <div className="px-5 pt-2 pb-6 border-t border-[var(--line)]">
          <button
            onClick={() => { if (confirm(`Remove ${contact.name}? This deletes the chat.`)) { removeContact(contact.id); onClose(); } }}
            className="w-full flex items-center gap-3 py-3.5 text-red-400"
          >
            <Trash2 size={18} /> <span className="text-[15px] font-medium">Remove contact</span>
          </button>
        </div>
      </div>
    </div>
  );
}
