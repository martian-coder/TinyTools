import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Lock, ArrowLeft, Send, ChevronRight, UserPlus, X, Check } from 'lucide-react';
import { useSiftStore } from '../store';
import { Avatar } from '../components/ui/Avatar';
import type { Group, GroupMessage } from '../types';
import {
  getOrCreateKeyPair,
  getPublicKeyB64,
  generateGroupKey,
  exportGroupKey,
  importGroupKey,
  encryptGroupKeyForMember,
  decryptGroupKey,
  encryptGroupMessage,
  decryptGroupMessage,
  packEncrypted,
  unpackEncrypted,
} from '../crypto';
import { supabaseBackend as backend } from '../services/backends/supabase';

// ── Local group store (not persisted — keys are in IDB) ─────────────────────

interface GroupStore {
  groups: Group[];
  messages: Record<string, GroupMessage[]>;
  activeGroupId: string | null;
}

let _groupStore: GroupStore = { groups: [], messages: {}, activeGroupId: null };
const _listeners = new Set<() => void>();

function notifyListeners() { _listeners.forEach(fn => fn()); }

function useGroupStore() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender(n => n + 1);
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  }, []);
  return _groupStore;
}

// ── Main Groups screen ───────────────────────────────────────────────────────

export function Groups() {
  const gs = useGroupStore();
  const currentUserId = useSiftStore(s => s.currentUserId);
  const contacts = useSiftStore(s => s.contacts);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load groups on mount
  useEffect(() => {
    if (!currentUserId) return;
    let active = true;

    async function loadGroups() {
      const raw = await backend.getUserGroups!(currentUserId!);
      if (!active) return;

      // Resolve group keys
      const kp = await getOrCreateKeyPair();
      const groups: Group[] = await Promise.all(
        raw.map(async (g) => {
          let groupKeyB64: string | undefined;
          if (g.encryptedKey && g.creatorPubKey) {
            try {
              const gk = await decryptGroupKey(g.encryptedKey, kp.privateKey, g.creatorPubKey);
              groupKeyB64 = await exportGroupKey(gk);
            } catch { /* key unavailable */ }
          }
          return {
            id: g.id, name: g.name, avatar: g.avatar || '👥',
            createdBy: g.createdBy, createdAt: g.createdAt,
            members: g.members.map(m => ({ ...m, displayName: contacts.find(c => c.id === m.userId)?.name })),
            encryptedKey: g.encryptedKey, creatorPubKey: g.creatorPubKey,
            groupKeyB64,
          };
        })
      );
      _groupStore = { ..._groupStore, groups };
      notifyListeners();
      setLoading(false);
    }

    loadGroups();

    // Poll for new group messages
    const unsub = backend.onGroupMessages!(currentUserId, async (msg) => {
      const group = _groupStore.groups.find(g => g.id === msg.groupId);
      let text = msg.text;
      if (group?.groupKeyB64) {
        const enc = unpackEncrypted(msg.text);
        if (enc?.type === 'group') {
          try {
            const gk = await importGroupKey(group.groupKeyB64);
            text = await decryptGroupMessage(enc.iv, enc.ct, gk);
          } catch { text = '🔒 (encrypted)'; }
        }
      }
      const gm: GroupMessage = {
        id: msg.id, groupId: msg.groupId,
        fromUserId: msg.fromUserId, fromName: msg.fromName,
        text, ts: msg.timestamp, encrypted: true,
      };
      _groupStore = {
        ..._groupStore,
        messages: {
          ..._groupStore.messages,
          [msg.groupId]: [...(_groupStore.messages[msg.groupId] || []), gm],
        },
      };
      notifyListeners();
    });

    return () => { active = false; unsub(); };
  }, [currentUserId, contacts]);

  if (gs.activeGroupId) {
    const group = gs.groups.find(g => g.id === gs.activeGroupId);
    if (group) return <GroupChat group={group} />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Users size={15} className="accent-t" />
          <span className="text-sm font-semibold text-main">Groups</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={12} /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12 text-sm dim">Loading…</div>
        )}
        {!loading && gs.groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="grid place-items-center" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--glass)' }}>
              <Users size={24} className="dim" />
            </div>
            <div className="text-sm dim text-center px-8">
              No groups yet.<br />Create one to start an encrypted group chat.
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs px-4 py-2 rounded-full mt-1"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Create a group
            </button>
          </div>
        )}
        {gs.groups.map(g => {
          const lastMsgs = _groupStore.messages[g.id] || [];
          const last = lastMsgs[lastMsgs.length - 1];
          return (
            <button
              key={g.id}
              onClick={() => { _groupStore = { ..._groupStore, activeGroupId: g.id }; notifyListeners(); }}
              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-[var(--glass)] transition-colors border-b border-[var(--border)]"
            >
              <div
                className="grid place-items-center flex-shrink-0 text-xl"
                style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--glass)' }}
              >
                {g.avatar || '👥'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold text-main truncate">{g.name}</span>
                  <Lock size={10} className="accent-t flex-shrink-0" />
                </div>
                <div className="text-xs dim truncate">
                  {last ? `${last.fromName || 'Someone'}: ${last.text}` : `${g.members.length} members · E2E encrypted`}
                </div>
              </div>
              <ChevronRight size={14} className="dim flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {showCreate && (
        <CreateGroup
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            // Reload
            if (currentUserId) backend.getUserGroups!(currentUserId).then(async (raw) => {
              const kp = await getOrCreateKeyPair();
              const groups: Group[] = await Promise.all(
                raw.map(async (g) => {
                  let groupKeyB64: string | undefined;
                  if (g.encryptedKey && g.creatorPubKey) {
                    try {
                      const gk = await decryptGroupKey(g.encryptedKey, kp.privateKey, g.creatorPubKey);
                      groupKeyB64 = await exportGroupKey(gk);
                    } catch { /* ignore */ }
                  }
                  return {
                    id: g.id, name: g.name, avatar: g.avatar || '👥',
                    createdBy: g.createdBy, createdAt: g.createdAt,
                    members: g.members.map(m => ({ ...m })),
                    encryptedKey: g.encryptedKey, creatorPubKey: g.creatorPubKey, groupKeyB64,
                  };
                })
              );
              _groupStore = { ..._groupStore, groups };
              notifyListeners();
            });
          }}
        />
      )}
    </div>
  );
}

// ── Group Chat ───────────────────────────────────────────────────────────────

function GroupChat({ group }: { group: Group }) {
  const currentUserId = useSiftStore(s => s.currentUserId);
  const contacts = useSiftStore(s => s.contacts);
  const gs = useGroupStore();
  const messages = gs.messages[group.id] || [];
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const myName = contacts.find(c => c.id === currentUserId)?.name ?? 'Me';

  const send = useCallback(async () => {
    if (!text.trim() || !currentUserId || sending) return;
    setSending(true);
    try {
      let wireText = text.trim();
      if (group.groupKeyB64) {
        const gk = await importGroupKey(group.groupKeyB64);
        const { iv, ct } = await encryptGroupMessage(wireText, gk);
        wireText = packEncrypted(iv, ct, 'group');
      }
      const id = await backend.sendGroupMessage!(group.id, currentUserId, myName, wireText);
      const gm: GroupMessage = {
        id, groupId: group.id, fromUserId: currentUserId,
        fromName: myName, text: text.trim(), ts: Date.now(), encrypted: !!group.groupKeyB64,
      };
      _groupStore = {
        ..._groupStore,
        messages: { ..._groupStore.messages, [group.id]: [...messages, gm] },
      };
      notifyListeners();
      setText('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }, [text, currentUserId, group, messages, myName, sending]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
        <button onClick={() => { _groupStore = { ..._groupStore, activeGroupId: null }; notifyListeners(); }}>
          <ArrowLeft size={18} className="dim" />
        </button>
        <div className="text-lg">{group.avatar || '👥'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-main leading-tight truncate">{group.name}</div>
          <div className="text-[10px] dim flex items-center gap-1">
            <Lock size={9} />
            {group.groupKeyB64 ? 'E2E encrypted' : 'No key yet'} · {group.members.length} members
          </div>
        </div>
        <button
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full dim"
          style={{ background: 'var(--glass)' }}
        >
          <UserPlus size={11} /> Invite
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 py-10">
            <Lock size={22} className="accent-t" />
            <div className="text-xs dim text-center">
              End-to-end encrypted.<br />Only group members can read these messages.
            </div>
          </div>
        )}
        {messages.map(m => {
          const isMe = m.fromUserId === currentUserId;
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && (
                <span className="text-[10px] dim mb-0.5 ml-1">{m.fromName}</span>
              )}
              <div
                className="px-3 py-2 text-sm max-w-[78%]"
                style={{
                  borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMe ? 'var(--accent)' : 'var(--glass)',
                  color: isMe ? '#fff' : 'var(--text)',
                }}
              >
                {m.text}
              </div>
              <div className="flex items-center gap-1 mt-0.5 mx-1">
                {m.encrypted && <Lock size={8} style={{ color: isMe ? 'var(--accent)' : 'var(--dim)' }} />}
                <span className="text-[9px] dim">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-[var(--border)] flex gap-2 items-end">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl" style={{ background: 'var(--glass)' }}>
          <input
            className="flex-1 bg-transparent text-sm text-main outline-none placeholder:text-[var(--dim)]"
            placeholder={group.groupKeyB64 ? 'Message (encrypted)…' : 'Message…'}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          />
          {group.groupKeyB64 && <Lock size={11} className="dim flex-shrink-0" />}
        </div>
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="grid place-items-center rounded-full flex-shrink-0"
          style={{ width: 36, height: 36, background: text.trim() ? 'var(--accent)' : 'var(--glass)' }}
        >
          <Send size={14} color={text.trim() ? '#fff' : 'var(--dim)'} />
        </button>
      </div>
    </div>
  );
}

// ── Create Group modal ───────────────────────────────────────────────────────

const GROUP_EMOJIS = ['👥', '🏠', '💼', '🎉', '🏀', '🎓', '💡', '🚀', '❤️', '🎮'];

function CreateGroup({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const currentUserId = useSiftStore(s => s.currentUserId);
  const contacts = useSiftStore(s => s.contacts);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('👥');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const create = async () => {
    if (!name.trim() || !currentUserId) return;
    if (selected.length === 0) { setError('Add at least 1 member.'); return; }
    setCreating(true);
    setError('');
    try {
      // Ensure our public key is published
      const myPubKey = await getPublicKeyB64();
      await backend.publishPublicKey!(currentUserId, myPubKey);

      // Generate group key
      const groupKey = await generateGroupKey();
      const kp = await getOrCreateKeyPair();

      // Encrypt group key for each member (need their public keys)
      const encryptedKeys: Record<string, string> = {};

      // Encrypt for self
      encryptedKeys[currentUserId] = await encryptGroupKeyForMember(groupKey, kp.privateKey, myPubKey);

      // Encrypt for each selected member
      for (const memberId of selected) {
        const theirPub = await backend.getPublicKey!(memberId);
        if (theirPub) {
          encryptedKeys[memberId] = await encryptGroupKeyForMember(groupKey, kp.privateKey, theirPub);
        }
      }

      await backend.createGroup!(
        currentUserId, name.trim(), avatar, selected, encryptedKeys, myPubKey,
      );
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  const realContacts = contacts.filter(c => c.id !== currentUserId && !c.id.startsWith('seed-'));

  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div
        className="w-full slide-up"
        style={{ background: 'var(--surface)', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Handle */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Users size={15} className="accent-t" />
            <span className="text-sm font-semibold text-main">New Group</span>
          </div>
          <button onClick={onClose}><X size={18} className="dim" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-4">
          {/* Emoji avatar picker */}
          <div className="flex gap-2 overflow-x-auto no-bar py-2 mb-3">
            {GROUP_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setAvatar(e)}
                className="flex-shrink-0 text-xl grid place-items-center rounded-xl"
                style={{
                  width: 40, height: 40,
                  background: avatar === e ? 'var(--accent)' : 'var(--glass)',
                  border: avatar === e ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Name */}
          <input
            className="w-full bg-[var(--glass)] text-sm text-main rounded-xl px-3 py-2.5 outline-none placeholder:text-[var(--dim)] mb-3"
            placeholder="Group name…"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          {/* Member list */}
          <div className="text-[11px] dim mb-2 flex items-center gap-1">
            <Lock size={9} /> All members get encrypted access
          </div>
          {realContacts.length === 0 && (
            <div className="text-xs dim py-4 text-center">
              Add contacts first (Contacts tab) to include them in a group.
            </div>
          )}
          {realContacts.map(c => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="w-full flex items-center gap-3 py-2.5 border-b border-[var(--border)] text-left"
              >
                <Avatar name={c.name} grad={c.grad} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-main truncate">{c.name}</div>
                  {c.phone && <div className="text-[10px] dim">{c.phone}</div>}
                </div>
                <div
                  className="grid place-items-center rounded-full flex-shrink-0"
                  style={{
                    width: 22, height: 22,
                    background: on ? 'var(--accent)' : 'var(--glass)',
                    border: on ? 'none' : '1.5px solid var(--border)',
                  }}
                >
                  {on && <Check size={11} color="#fff" />}
                </div>
              </button>
            );
          })}

          {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
        </div>

        <div className="px-4 pb-5 pt-2 border-t border-[var(--border)]">
          <button
            onClick={create}
            disabled={!name.trim() || creating}
            className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ background: name.trim() ? 'var(--accent)' : 'var(--glass)', color: name.trim() ? '#fff' : 'var(--dim)' }}
          >
            {creating ? 'Creating…' : `Create Group${selected.length ? ` (${selected.length + 1})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
