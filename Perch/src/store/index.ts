import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMsg, ParentTab, PerchEvent, Role } from '../types';

interface PerchState {
  role: Role;
  demo: boolean;
  /** Parent side: label for the protected phone ("Aryan's phone"). */
  kidAlias: string;
  /** Capability UUID for this pairing (both sides once linked). */
  pairingId: string | null;
  /** Parent side: the one-shot code shown until the kid's phone claims it. */
  pendingCode: string | null;
  /** True once the kid's phone has claimed the code. */
  linked: boolean;
  events: PerchEvent[];
  chat: ChatMsg[];
  apiKey: string;
  tab: ParentTab;
  /** Parent: last time an events fetch succeeded (epoch ms). */
  lastSync: number;

  setRole: (r: Role) => void;
  startDemo: (events: PerchEvent[], greeting: ChatMsg) => void;
  setKidAlias: (name: string) => void;
  setPairing: (pairingId: string | null, pendingCode: string | null) => void;
  setLinked: (linked: boolean) => void;
  addEvents: (evts: PerchEvent[]) => void;
  addChat: (msg: ChatMsg) => void;
  clearChat: () => void;
  setApiKey: (k: string) => void;
  setTab: (t: ParentTab) => void;
  setLastSync: (t: number) => void;
  reset: () => void;
}

const initial = {
  role: 'unset' as Role,
  demo: false,
  kidAlias: '',
  pairingId: null,
  pendingCode: null,
  linked: false,
  events: [] as PerchEvent[],
  chat: [] as ChatMsg[],
  apiKey: '',
  tab: 'home' as ParentTab,
  lastSync: 0,
};

export const usePerch = create<PerchState>()(
  persist(
    (set, get) => ({
      ...initial,

      setRole: (role) => set({ role }),
      startDemo: (events, greeting) =>
        set({ role: 'parent', demo: true, kidAlias: 'Aryan', linked: true, events, chat: [greeting] }),
      setKidAlias: (kidAlias) => set({ kidAlias }),
      setPairing: (pairingId, pendingCode) => set({ pairingId, pendingCode }),
      setLinked: (linked) => set({ linked }),
      addEvents: (evts) => {
        const seen = new Set(get().events.map(e => e.id));
        const fresh = evts.filter(e => !seen.has(e.id));
        if (!fresh.length) return;
        set({ events: [...get().events, ...fresh].sort((a, b) => b.at - a.at).slice(0, 500) });
      },
      addChat: (msg) => set({ chat: [...get().chat, msg].slice(-200) }),
      clearChat: () => set({ chat: [] }),
      setApiKey: (apiKey) => set({ apiKey }),
      setTab: (tab) => set({ tab }),
      setLastSync: (lastSync) => set({ lastSync }),
      reset: () => set({ ...initial }),
    }),
    { name: 'perch-store' },
  ),
);

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
