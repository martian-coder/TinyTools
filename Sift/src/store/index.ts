import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Contact, Message, UserSettings, Folder, RouteResult } from '../types';
import { SEED_CONTACTS, SEED_MESSAGES, DEFAULT_SETTINGS } from '../seed';

type Screen = 'chats' | 'conversation' | 'settings' | 'simulator';

interface SiftState {
  contacts: Contact[];
  messages: Message[];
  settings: UserSettings;
  activeScreen: Screen;
  activeFolder: Folder;
  activeContactId: string | null;
  pendingAsk: { messageId: string; text: string } | null;

  // Actions
  setScreen: (screen: Screen) => void;
  setFolder: (folder: Folder) => void;
  openConversation: (contactId: string) => void;
  sendMessage: (contactId: string, text: string) => void;
  receiveMessage: (contactId: string, text: string, route: RouteResult, verdict: import('../types').ModerationVerdict) => void;
  approveMessage: (id: string) => void;
  rejectMessage: (id: string) => void;
  clearReview: () => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  updateCivility: (patch: Partial<UserSettings['civility']>) => void;
  updateSpam: (patch: Partial<UserSettings['spam']>) => void;
  updateBusiness: (patch: Partial<UserSettings['business']>) => void;
  toggleTrusted: (contactId: string) => void;
  resolvePendingAsk: (approve: boolean) => void;
  resetToSeed: () => void;
}

export const useSiftStore = create<SiftState>()(
  persist(
    (set, get) => ({
      contacts: SEED_CONTACTS,
      messages: SEED_MESSAGES,
      settings: DEFAULT_SETTINGS,
      activeScreen: 'chats',
      activeFolder: 'primary',
      activeContactId: null,
      pendingAsk: null,

      setScreen: (screen) => set({ activeScreen: screen }),
      setFolder: (folder) => set({ activeFolder: folder }),

      openConversation: (contactId) => set({ activeContactId: contactId, activeScreen: 'conversation' }),

      sendMessage: (contactId, text) => {
        const msg: Message = {
          id: `m${Date.now()}`,
          contactId,
          text,
          dir: 'out',
          ts: Date.now(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          folder: 'primary',
          status: 'delivered',
        };
        set(s => ({ messages: [...s.messages, msg] }));
      },

      receiveMessage: (contactId, text, route, verdict) => {
        const msg: Message = {
          id: `m${Date.now()}`,
          contactId,
          text,
          dir: 'in',
          ts: Date.now(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          verdict,
          folder: route.folder,
          status: route.status,
          autoReply: !!route.autoReply,
        };
        set(s => {
          const next = { messages: [...s.messages, msg] };
          if (route.ask) {
            return { ...next, pendingAsk: { messageId: msg.id, text } };
          }
          return next;
        });
      },

      approveMessage: (id) => {
        set(s => ({
          messages: s.messages.map(m =>
            m.id === id ? { ...m, folder: 'primary', status: 'approved' } : m
          ),
        }));
      },

      rejectMessage: (id) => {
        set(s => ({
          messages: s.messages.map(m =>
            m.id === id ? { ...m, status: 'rejected' } : m
          ),
        }));
      },

      clearReview: () => {
        set(s => ({
          messages: s.messages.map(m =>
            (m.folder === 'review' && (m.status === 'held' || m.status === 'approved'))
              ? { ...m, status: 'rejected' }
              : m
          ),
        }));
      },

      updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),
      updateCivility: (patch) => set(s => ({ settings: { ...s.settings, civility: { ...s.settings.civility, ...patch } } })),
      updateSpam: (patch) => set(s => ({ settings: { ...s.settings, spam: { ...s.settings.spam, ...patch } } })),
      updateBusiness: (patch) => set(s => ({ settings: { ...s.settings, business: { ...s.settings.business, ...patch } } })),

      toggleTrusted: (contactId) => {
        const { settings } = get();
        const ids = settings.trustedIds.includes(contactId)
          ? settings.trustedIds.filter(id => id !== contactId)
          : [...settings.trustedIds, contactId];
        set(s => ({ settings: { ...s.settings, trustedIds: ids } }));
      },

      resolvePendingAsk: (approve) => {
        const { pendingAsk } = get();
        if (!pendingAsk) return;
        if (approve) {
          get().approveMessage(pendingAsk.messageId);
        } else {
          get().rejectMessage(pendingAsk.messageId);
        }
        set({ pendingAsk: null });
      },

      resetToSeed: () => set({
        contacts: SEED_CONTACTS,
        messages: SEED_MESSAGES,
        settings: DEFAULT_SETTINGS,
        activeScreen: 'chats',
        activeFolder: 'primary',
        activeContactId: null,
        pendingAsk: null,
      }),
    }),
    {
      name: 'sift-store',
      partialize: (s) => ({
        contacts: s.contacts,
        messages: s.messages,
        settings: s.settings,
      }),
    }
  )
);

// Selectors
export const selectConversation = (state: SiftState, contactId: string) =>
  state.messages
    .filter(m => m.contactId === contactId && m.status !== 'dropped' && m.status !== 'rejected')
    .sort((a, b) => a.ts - b.ts);

export const selectFolderThreads = (state: SiftState, folder: Folder) => {
  const contactMap = new Map<string, Message>();
  for (const msg of state.messages) {
    if (msg.folder !== folder) continue;
    if (msg.status === 'dropped' || msg.status === 'rejected') continue;
    const existing = contactMap.get(msg.contactId);
    if (!existing || msg.ts > existing.ts) contactMap.set(msg.contactId, msg);
  }
  return Array.from(contactMap.values()).sort((a, b) => b.ts - a.ts);
};

export const selectReviewMessages = (state: SiftState) =>
  state.messages.filter(m => m.folder === 'review' && m.status === 'held').sort((a, b) => b.ts - a.ts);

export const selectUnreadCount = (state: SiftState, folder: Folder) => {
  if (folder === 'review') return selectReviewMessages(state).length;
  return selectFolderThreads(state, folder).filter(m => m.dir === 'in' && m.status === 'delivered').length;
};
