import { useState } from 'react';
import { useSiftStore } from '../store';
import { Avatar } from './ui/Avatar';
import { CIRCLE_META, type Circle } from '../moderation/profiles';
import type { DisappearingMessageMode } from '../types';
import { Check, ShieldCheck, Ban, Trash2, MessageCircle, Timer, Users2 } from 'lucide-react';

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

function fmtRemaining(ts: number): string {
  const ms = ts - Date.now();
  if (ms <= 0) return 'expiring…';
  const hrs = Math.ceil(ms / 3_600_000);
  return hrs < 24 ? `${hrs}h left` : `${Math.ceil(hrs / 24)}d left`;
}

const sectionLabel = 'text-[11px] font-semibold uppercase tracking-wide dim mb-2.5 flex items-center gap-1.5';
const pill = (active: boolean) =>
  `px-3.5 py-2 rounded-full text-[13px] font-medium transition ${
    active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-hover)] text-main hover:opacity-80'
  }`;
const actionBtn = 'flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-[var(--surface-hover)]/60 hover:bg-[var(--surface-hover)] text-main text-[11px] font-medium transition';

/**
 * The ONE contact long-press / options menu — openable from the inbox,
 * Contacts, the chat header, or Commander. Rename (saved only on this
 * device), message, trust, circle, temp/permanent block, per-chat
 * disappearing messages, or remove.
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
  const [nameEdit, setNameEdit] = useState(contact?.name ?? '');
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  if (!contact) return null;

  const isBlocked = !!contact.blocked && (!contact.blockedUntil || contact.blockedUntil > Date.now());

  const save = () => {
    upsertContact({ id: contact.id, name: nameEdit.trim() || contact.name, phone: contact.phone });
    setBanner('✓ Name saved');
    onClose();
  };

  const block = (hours?: number) => {
    setBlocked(contact.id, true, hours ? Date.now() + hours * 3_600_000 : undefined);
    setShowBlockPicker(false);
    setBanner(hours ? `🚫 Blocked for ${hours < 24 ? hours + 'h' : hours / 24 + 'd'}` : '🚫 Blocked');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-[var(--surface)] w-full max-w-sm rounded-2xl border border-[var(--border)] p-5 max-h-[85vh] overflow-y-auto no-bar"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2 pb-5 border-b border-[var(--border)]">
          <Avatar name={contact.name} grad={contact.grad} size={68} trusted={contact.trusted} />
          <div className="flex items-center gap-2 mt-1 w-full">
            <input
              value={nameEdit}
              onChange={e => setNameEdit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              className="flex-1 text-center font-semibold text-main bg-transparent border-b border-[var(--border)] py-1 focus:outline-none focus:border-[var(--accent)]"
            />
            <button onClick={save}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold shrink-0">
              <Check size={15} /> Save
            </button>
          </div>
          <div className="text-sm dim">{contact.phone || 'no number'}</div>
          {isBlocked && (
            <div className="text-xs text-amber-400 font-medium">
              🚫 Blocked{contact.blockedUntil ? ` · ${fmtRemaining(contact.blockedUntil)}` : ''}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="pt-5">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => { openConversation(contact.id); onClose(); }} className={actionBtn}>
              <MessageCircle size={19} /> Message
            </button>
            <button onClick={() => toggleTrusted(contact.id)} className={actionBtn}>
              <ShieldCheck size={19} className={contact.trusted ? 'text-emerald-400' : ''} />
              {contact.trusted ? 'Trusted' : 'Trust'}
            </button>
            <button
              onClick={() => {
                if (isBlocked) { setBlocked(contact.id, false); setBanner('✓ Unblocked'); }
                else setShowBlockPicker(v => !v);
              }}
              className={`${actionBtn} ${isBlocked || showBlockPicker ? 'text-amber-400' : ''}`}
            >
              <Ban size={19} /> {isBlocked ? 'Unblock' : 'Block'}
            </button>
          </div>

          {showBlockPicker && !isBlocked && (
            <div className="flex gap-2 mt-2">
              {BLOCK_OPTIONS.map(o => (
                <button key={o.label} onClick={() => block(o.hours)} className={`flex-1 ${pill(false)} text-center`}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Circle */}
        <div className="pt-5 mt-5 border-t border-[var(--border)]">
          <div className={sectionLabel}><Users2 size={12} /> Circle</div>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(CIRCLE_META) as [Circle, typeof CIRCLE_META[Circle]][]).map(([id, meta]) => (
              <button
                key={id}
                onClick={() => setContactCircle(contact.id, contact.circle === id ? undefined : id)}
                className={pill(contact.circle === id)}
              >
                {meta.emoji} {meta.label}
              </button>
            ))}
          </div>
        </div>

        {/* Disappearing messages */}
        <div className="pt-5 mt-5 border-t border-[var(--border)]">
          <div className={sectionLabel}><Timer size={12} /> Disappearing messages</div>
          <div className="flex flex-wrap gap-2">
            {DISAPPEAR_OPTIONS.map(o => (
              <button key={o.label} onClick={() => setDisappearMode(contact.id, o.mode)} className={pill(contact.disappearMode === o.mode)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Danger zone */}
        <div className="pt-5 mt-5 border-t border-[var(--border)]">
          <button
            onClick={() => { if (confirm(`Remove ${contact.name}? This deletes the chat.`)) { removeContact(contact.id); onClose(); } }}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium"
          >
            <Trash2 size={15} /> Remove contact
          </button>
          <button onClick={onClose} className="w-full mt-2 py-2 text-sm dim">Close</button>
        </div>
      </div>
    </div>
  );
}
