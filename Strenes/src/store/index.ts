import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Contact, Message, UserSettings, Folder, RouteResult, ModerationVerdict } from '../types';
import { SEED_CONTACTS, SEED_MESSAGES, DEFAULT_SETTINGS } from '../seed';

export type Screen = 'chats' | 'conversation' | 'settings' | 'simulator' | 'digest';

interface SiftState {
  contacts: Contact[];
  messages: Message[];
  settings: UserSettings;
  activeScreen: Screen;
  activeFolder: Folder;
  activeContactId: string | null;
  pendingAsk: { messageId: string; text: string } | null;
  revealed: Record<string, boolean>;
  banner: string | null;

  setScreen: (s: Screen) => void;
  setFolder: (f: Folder) => void;
  openConversation: (contactId: string) => void;
  setRevealed: (id: string) => void;
  setBanner: (msg: string | null) => void;
  sendMessage: (contactId: string, text: string) => void;
  sendOutgoingToReview: (contactId: string, text: string, verdict: ModerationVerdict) => void;
  receiveMessage: (contactId: string, text: string, route: RouteResult, verdict: ModerationVerdict) => void;
  approveMessage: (id: string) => void;
  rejectMessage: (id: string) => void;
  clearReview: () => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  updateCivility: (patch: Partial<UserSettings['civility']>) => void;
  updateSpam: (patch: Partial<UserSettings['spam']>) => void;
  updateBusiness: (patch: Partial<UserSettings['business']>) => void;
  updateDND: (patch: Partial<UserSettings['dnd']>) => void;
  updateDrunkMode: (patch: Partial<UserSettings['drunkMode']>) => void;
  updateDisappearingMessages: (patch: Partial<UserSettings['disappearingMessages']>) => void;
  updateUnhingedMode: (patch: Partial<UserSettings['unhingedMode']>) => void;
  updateToneChecker: (patch: Partial<UserSettings['toneChecker']>) => void;
  updateSpellCheck: (patch: Partial<UserSettings['spellCheck']>) => void;
  setContactEmergency: (contactId: string, isEmergency: boolean) => void;
  toggleTrusted: (contactId: string) => void;
  setContactTrusted: (contactId: string, trusted: boolean) => void;
  resolvePendingAsk: (approve: boolean) => void;
  resetToSeed: () => void;
}

let idCounter = 200;
const nid = () => `m${idCounter++}`;

export const useSiftStore = create<SiftState>()(
  persist(
    (set, get) => ({
      contacts:         SEED_CONTACTS,
      messages:         SEED_MESSAGES,
      settings:         DEFAULT_SETTINGS,
      activeScreen:     'chats',
      activeFolder:     'primary',
      activeContactId:  null,
      pendingAsk:       null,
      revealed:         {},
      banner:           null,

      setScreen: s  => set({ activeScreen: s }),
      setFolder: f  => set({ activeFolder: f }),
      openConversation: id => set({ activeContactId: id, activeScreen: 'conversation' }),
      setRevealed: id => set(s => ({ revealed: { ...s.revealed, [id]: true } })),
      setBanner: msg => set({ banner: msg }),

      sendMessage: (contactId, text) => set(s => ({
        messages: [...s.messages, {
          id: nid(), contactId, text, dir: 'out',
          ts: Date.now(), time: 'now',
          folder: 'primary', status: 'delivered',
        }],
      })),

      sendOutgoingToReview: (contactId, text, verdict) => set(s => ({
        messages: [...s.messages, {
          id: nid(), contactId, text, dir: 'out',
          ts: Date.now(), time: 'now',
          folder: 'review', status: 'held', verdict,
        }],
      })),

      receiveMessage: (contactId, text, route, verdict) => {
        const newMsg: Message = {
          id: nid(), contactId, text, dir: 'in',
          ts: Date.now(), time: 'now',
          verdict, folder: route.folder, status: route.status,
          autoReply: route.autoReply,
        };
        set(s => {
          const messages = [...s.messages, newMsg];
          if (route.ask) {
            return { messages, pendingAsk: { messageId: newMsg.id, text } };
          }
          return { messages };
        });
      },

      approveMessage: id => set(s => ({
        messages: s.messages.map(m => m.id === id ? { ...m, status: 'approved', folder: 'primary' } : m),
      })),

      rejectMessage: id => set(s => ({
        messages: s.messages.map(m => m.id === id ? { ...m, status: 'rejected' } : m),
      })),

      clearReview: () => set(s => ({
        messages: s.messages.map(m =>
          (m.folder === 'review' && (m.status === 'held' || m.status === 'approved'))
            ? { ...m, status: 'rejected' } : m
        ),
      })),

      updateSettings: patch => set(s => ({ settings: { ...s.settings, ...patch } })),
      updateCivility: patch => set(s => ({ settings: { ...s.settings, civility: { ...s.settings.civility, ...patch } } })),
      updateSpam:     patch => set(s => ({ settings: { ...s.settings, spam:     { ...s.settings.spam,     ...patch } } })),
      updateBusiness: patch => set(s => ({ settings: { ...s.settings, business: { ...s.settings.business, ...patch } } })),
      updateDND:      patch => set(s => ({ settings: { ...s.settings, dnd:      { ...s.settings.dnd,      ...patch } } })),
      updateDrunkMode: patch => set(s => ({ settings: { ...s.settings, drunkMode: { ...s.settings.drunkMode, ...patch } } })),
      updateDisappearingMessages: patch => set(s => ({ settings: { ...s.settings, disappearingMessages: { ...s.settings.disappearingMessages, ...patch } } })),
      updateUnhingedMode: patch => set(s => ({ settings: { ...s.settings, unhingedMode: { ...s.settings.unhingedMode, ...patch } } })),
      updateToneChecker: patch => set(s => ({ settings: { ...s.settings, toneChecker: { ...s.settings.toneChecker, ...patch } } })),
      updateSpellCheck: patch => set(s => ({ settings: { ...s.settings, spellCheck: { ...s.settings.spellCheck, ...patch } } })),

      setContactEmergency: (id, isEmergency) => set(s => ({
        contacts: s.contacts.map(c => c.id === id ? { ...c, isEmergency } : c),
      })),

      toggleTrusted: id => set(s => ({
        contacts: s.contacts.map(c => c.id === id ? { ...c, trusted: !c.trusted } : c),
        settings: {
          ...s.settings,
          trustedIds: s.contacts.find(c => c.id === id)?.trusted
            ? s.settings.trustedIds.filter(x => x !== id)
            : [...s.settings.trustedIds, id],
        },
      })),

      setContactTrusted: (id, trusted) => set(s => ({
        contacts: s.contacts.map(c => c.id === id ? { ...c, trusted } : c),
        settings: {
          ...s.settings,
          trustedIds: trusted
            ? [...new Set([...s.settings.trustedIds, id])]
            : s.settings.trustedIds.filter(x => x !== id),
        },
      })),

      resolvePendingAsk: approve => {
        const { pendingAsk } = get();
        if (!pendingAsk) return;
        if (approve) get().approveMessage(pendingAsk.messageId);
        else         get().rejectMessage(pendingAsk.messageId);
        set({ pendingAsk: null });
      },

      resetToSeed: () => set({
        contacts: SEED_CONTACTS, messages: SEED_MESSAGES, settings: DEFAULT_SETTINGS,
        activeScreen: 'chats', activeFolder: 'primary', activeContactId: null,
        pendingAsk: null, revealed: {}, banner: null,
      }),
    }),
    {
      name: 'sift-v2',
      partialize: s => ({ contacts: s.contacts, messages: s.messages, settings: s.settings }),
    }
  )
);

// Selectors
export const selectConversation = (s: SiftState, contactId: string) =>
  s.messages
    .filter(m => m.contactId === contactId && (
      m.dir === 'out' || m.status === 'delivered' || m.status === 'approved'
    ))
    .sort((a, b) => a.ts - b.ts);
