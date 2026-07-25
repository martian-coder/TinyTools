import { useState } from 'react';
import { useSiftStore } from '../store';
import { Avatar } from './ui/Avatar';
import { Check, ShieldCheck, Ban, Trash2 } from 'lucide-react';

/**
 * The ONE contact profile dialog — openable from the inbox, Contacts,
 * the chat header, or Commander. Edit the name you call this person
 * (saved only on your device), trust, block, or remove them.
 */
export function ContactProfileModal({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const contact = useSiftStore(s => s.contacts.find(c => c.id === contactId));
  const upsertContact = useSiftStore(s => s.upsertContact);
  const toggleTrusted = useSiftStore(s => s.toggleTrusted);
  const setBlocked = useSiftStore(s => s.setBlocked);
  const removeContact = useSiftStore(s => s.removeContact);
  const setBanner = useSiftStore(s => s.setBanner);
  const [nameEdit, setNameEdit] = useState(contact?.name ?? '');

  if (!contact) return null;

  const save = () => {
    upsertContact({ id: contact.id, name: nameEdit.trim() || contact.name, phone: contact.phone });
    setBanner('✓ Name saved');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] w-full max-w-sm rounded-2xl border border-[var(--border)] p-5" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-2 pb-4 border-b border-[var(--border)]">
          <Avatar name={contact.name} grad={contact.grad} size={72} trusted={contact.trusted} />
          <div className="flex items-center gap-2 mt-1 w-full">
            <input
              value={nameEdit}
              onChange={e => setNameEdit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              className="flex-1 text-center font-semibold text-main bg-transparent border-b border-[var(--border)] py-1 focus:outline-none focus:border-[var(--accent)]"
            />
            <button onClick={save}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold">
              <Check size={15} /> Save
            </button>
          </div>
          <div className="text-sm dim">{contact.phone || 'no number'}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-4">
          <button onClick={() => toggleTrusted(contact.id)} className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[var(--surface-hover)] text-main">
            <ShieldCheck size={18} className={contact.trusted ? 'text-emerald-400' : ''} /><span className="text-xs">{contact.trusted ? 'Trusted' : 'Trust'}</span>
          </button>
          <button onClick={() => setBlocked(contact.id, !contact.blocked)} className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[var(--surface-hover)] text-amber-400">
            <Ban size={18} /><span className="text-xs">{contact.blocked ? 'Unblock' : 'Block'}</span>
          </button>
          <button onClick={() => { if (confirm(`Remove ${contact.name}? This deletes the chat.`)) { removeContact(contact.id); onClose(); } }}
            className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-[var(--surface-hover)] text-red-400">
            <Trash2 size={18} /><span className="text-xs">Remove</span>
          </button>
        </div>
        <button onClick={onClose} className="w-full mt-4 py-2 text-sm dim">Close</button>
      </div>
    </div>
  );
}
