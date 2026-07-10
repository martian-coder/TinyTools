import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Contact, Message, MessageRoute, UserSettings, Folder, RouteResult, ModerationVerdict, DynamicRule, MemoryNote } from '../types';
import { SEED_CONTACTS, SEED_MESSAGES, DEFAULT_SETTINGS } from '../seed';
import { PROFILES, type ProfileId } from '../moderation/profiles';

export type Screen = 'chats' | 'conversation' | 'settings' | 'simulator' | 'digest' | 'commander' | 'contacts';

export interface ActiveCall {
  peerId: string;
  direction: 'in' | 'out';
  status: 'ringing' | 'incoming' | 'connected';
  startedAt?: number;
}

interface SiftState {
  currentUserId: string | null;
  currentUserPhone: string | null;
  contacts: Contact[];
  messages: Message[];
  settings: UserSettings;
  activeScreen: Screen;
  activeFolder: Folder;
  activeContactId: string | null;
  pendingAsk: { messageId: string; text: string } | null;
  revealed: Record<string, boolean>;
  banner: string | null;

  setCurrentUser: (userId: string, phone: string) => void;
  clearCurrentUser: () => void;
  upsertContact: (contact: { id: string; name: string; phone?: string; online?: boolean }) => void;
  activeCall: ActiveCall | null;
  setActiveCall: (call: ActiveCall | null) => void;
  setScreen: (s: Screen) => void;
  setFolder: (f: Folder) => void;
  openConversation: (contactId: string) => void;
  setRevealed: (id: string) => void;
  setBanner: (msg: string | null) => void;
  sendMessage: (contactId: string, text: string, route?: MessageRoute) => string;
  setMessageRelayId: (localId: string, relayId: string) => void;
  applyReceipt: (contactId: string, receipt: { kind: 'delivered' | 'read' | 'held' | 'filtered'; ids: string[]; reason?: string }) => void;
  markIncomingRead: (contactId: string) => string[];
  flushQueue: () => void;
  sendOutgoingToReview: (contactId: string, text: string, verdict: ModerationVerdict) => void;
  receiveMessage: (contactId: string, text: string, route: RouteResult, verdict: ModerationVerdict, meta?: { relayId?: string }) => void;
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
  updateAiReplies: (patch: Partial<UserSettings['aiReplies']>) => void;
  updateAiModeration: (patch: Partial<UserSettings['aiModeration']>) => void;
  updateSmsFallback: (patch: Partial<UserSettings['smsFallback']>) => void;
  setContactEmergency: (contactId: string, isEmergency: boolean) => void;
  toggleTrusted: (contactId: string) => void;
  setContactTrusted: (contactId: string, trusted: boolean) => void;
  setContactCircle: (contactId: string, circle: 'family' | 'work' | 'friends' | 'vip' | undefined) => void;
  resolvePendingAsk: (approve: boolean) => void;
  addDynamicRule: (contactId: string, condition: string, action: 'block' | 'review', expiresAt?: number) => void;
  muteContact: (contactId: string, untilTs: number) => void;
  unmuteContact: (contactId: string) => void;
  applyProfile: (profileId: ProfileId) => void;
  addMemoryNote: (text: string, kind: 'fact' | 'situation', expiresAt?: number) => void;
  forgetMemory: (target: 'all' | string) => number;
  getActiveMemory: () => MemoryNote[];
  removeDynamicRule: (ruleId: string) => void;
  toggleDynamicRule: (ruleId: string) => void;
  updateDynamicRule: (ruleId: string, patch: Partial<Omit<DynamicRule, 'id' | 'contactId' | 'createdAt'>>) => void;
  getDynamicRulesForContact: (contactId: string) => DynamicRule[];
  checkAndReceiveMessage: (contactId: string, text: string, route: RouteResult, verdict: ModerationVerdict, apiKey: string, meta?: { relayId?: string }) => Promise<RouteResult>;
  loadDemoData: () => void;
  resetToSeed: () => void;
}

let idCounter = 200;
const nid = () => `m${idCounter++}-${Date.now().toString(36)}`;

/** Human timestamp for the chat list / bubbles ("9:41" style, matches seed data). */
const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });

const CONTACT_GRADS = [
  'linear-gradient(135deg,#7c83ff,#22d3ee)',
  'linear-gradient(135deg,#fb7185,#fb923c)',
  'linear-gradient(135deg,#34d399,#06b6d4)',
  'linear-gradient(135deg,#a78bfa,#f472b6)',
  'linear-gradient(135deg,#38bdf8,#6366f1)',
];

/** Deterministic gradient per contact id so avatars are stable across sessions. */
function gradFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CONTACT_GRADS[h % CONTACT_GRADS.length];
}

function calcDisappearsAt(settings: UserSettings): number | undefined {
  const dm = settings.disappearingMessages;
  if (!dm.enabled || dm.defaultMode === 'off') return undefined;
  const now = Date.now();
  const MODES: Record<string, number> = {
    onRead: 30_000,
    '1m':   60_000,
    '5m':   5 * 60_000,
    '1h':   60 * 60_000,
    '24h':  24 * 60 * 60_000,
    custom: (dm.customMinutes ?? 5) * 60_000,
  };
  const ttl = MODES[dm.defaultMode];
  return ttl ? now + ttl : undefined;
}

export const useSiftStore = create<SiftState>()(
  persist(
    (set, get) => ({
      // Fresh installs start with an EMPTY inbox — no fake users. Demo data
      // loads only when the user explicitly enters demo mode (loadDemoData).
      currentUserId:    null,
      currentUserPhone: null,
      contacts:         [],
      messages:         [],
      settings:         DEFAULT_SETTINGS,
      activeScreen:     'commander',
      activeFolder:     'primary',
      activeContactId:  null,
      pendingAsk:       null,
      revealed:         {},
      banner:           null,

      setCurrentUser: (userId, phone) => set({ currentUserId: userId, currentUserPhone: phone }),
      clearCurrentUser: () => set({ currentUserId: null, currentUserPhone: null }),

      activeCall: null,
      setActiveCall: call => set({ activeCall: call }),

      upsertContact: ({ id, name, phone, online }) => set(s => {
        const existing = s.contacts.find(c => c.id === id);
        if (existing) {
          return {
            contacts: s.contacts.map(c =>
              c.id === id ? { ...c, name: name || c.name, phone: phone ?? c.phone, online } : c
            ),
          };
        }
        return {
          contacts: [...s.contacts, { id, name: name || phone || 'Unknown', phone, online, trusted: false, grad: gradFor(id) }],
        };
      }),
      setScreen: s  => set({ activeScreen: s }),
      setFolder: f  => set({ activeFolder: f }),
      openConversation: id => set({ activeContactId: id, activeScreen: 'conversation' }),
      setRevealed: id => set(s => ({ revealed: { ...s.revealed, [id]: true } })),
      setBanner: msg => set({ banner: msg }),

      sendMessage: (contactId, text, route = 'ip') => {
        const id = nid();
        set(s => ({
          messages: [...s.messages, {
            id, contactId, text, dir: 'out',
            ts: Date.now(), time: nowTime(),
            folder: 'primary', status: 'delivered',
            disappearsAt: calcDisappearsAt(s.settings),
            route,
          }],
        }));
        return id;
      },

      setMessageRelayId: (localId, relayId) => set(s => ({
        messages: s.messages.map(m => m.id === localId ? { ...m, relayId } : m),
      })),

      applyReceipt: (contactId, receipt) => set(s => ({
        messages: s.messages.map(m => {
          if (m.dir !== 'out' || m.contactId !== contactId || !m.relayId || !receipt.ids.includes(m.relayId)) return m;
          // Ticks only upgrade (sent → delivered → read); held/filtered always land.
          const rank = { delivered: 1, read: 2 } as Record<string, number>;
          if ((receipt.kind === 'delivered' || receipt.kind === 'read') &&
              m.receipt && (rank[m.receipt] ?? 0) >= rank[receipt.kind]) return m;
          return { ...m, receipt: receipt.kind, receiptReason: receipt.reason };
        }),
      })),

      markIncomingRead: (contactId) => {
        // Collect incoming messages that were actually viewed and still owe a
        // read receipt; mark them sent and return relay ids for the caller.
        const pending = get().messages.filter(m =>
          m.dir === 'in' && m.contactId === contactId && m.relayId && !m.readReceiptSent &&
          (m.status === 'delivered' || m.status === 'approved'));
        if (pending.length === 0) return [];
        const ids = pending.map(m => m.relayId!);
        const idSet = new Set(pending.map(m => m.id));
        set(s => ({
          messages: s.messages.map(m => idSet.has(m.id) ? { ...m, readReceiptSent: true } : m),
        }));
        return ids;
      },

      flushQueue: () => {
        const { messages, currentUserId } = get();
        const queued = messages.filter(m => m.route === 'queued' && m.dir === 'out');
        set(s => ({
          messages: s.messages.map(m =>
            m.route === 'queued' ? { ...m, route: 'ip' as MessageRoute } : m
          ),
        }));
        // Actually deliver the queued messages through the relay, not just
        // relabel them. Backend import is dynamic to avoid a module cycle.
        if (currentUserId && queued.length > 0) {
          import('../services/backend').then(({ sendMessage }) => {
            for (const m of queued) {
              sendMessage(currentUserId, m.contactId, m.text).catch(err =>
                console.error('Failed to flush queued message:', err));
            }
          });
        }
      },

      sendOutgoingToReview: (contactId, text, verdict) => set(s => ({
        messages: [...s.messages, {
          id: nid(), contactId, text, dir: 'out',
          ts: Date.now(), time: nowTime(),
          folder: 'review', status: 'held', verdict,
        }],
      })),

      receiveMessage: (contactId, text, route, verdict, meta) => {
        const { settings } = get();
        const newMsg: Message = {
          id: nid(), contactId, text, dir: 'in',
          ts: Date.now(), time: nowTime(),
          verdict, folder: route.folder, status: route.status,
          autoReply: route.autoReply,
          disappearsAt: route.status === 'delivered' ? calcDisappearsAt(settings) : undefined,
          relayId: meta?.relayId,
        };
        set(s => {
          const messages = [...s.messages, newMsg];
          if (route.ask) {
            return { messages, pendingAsk: { messageId: newMsg.id, text } };
          }
          return { messages };
        });
      },

      approveMessage: id => {
        const msg = get().messages.find(m => m.id === id);
        set(s => ({
          messages: s.messages.map(m => m.id === id ? { ...m, status: 'approved', folder: 'primary' } : m),
        }));
        // The sender saw "held" — tell them it got through after all.
        const me = get().currentUserId;
        if (me && msg?.relayId && msg.dir === 'in') {
          import('../services/receipts').then(({ sendReceipt }) =>
            sendReceipt(me, msg.contactId, { kind: 'delivered', ids: [msg.relayId!] }));
        }
      },

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
      updateAiReplies: patch => set(s => ({ settings: { ...s.settings, aiReplies: { ...s.settings.aiReplies, ...patch } } })),
      updateAiModeration: patch => set(s => ({ settings: { ...s.settings, aiModeration: { ...s.settings.aiModeration, ...patch } } })),
      updateSmsFallback: patch => set(s => ({ settings: { ...s.settings, smsFallback: { ...s.settings.smsFallback, ...patch } } })),

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

      setContactCircle: (id, circle) => set(s => ({
        contacts: s.contacts.map(c => c.id === id ? { ...c, circle } : c),
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

      addDynamicRule: (contactId, condition, action, expiresAt) => set(s => ({
        settings: {
          ...s.settings,
          dynamicRules: [
            // Drop rules that have already expired while we're here.
            ...s.settings.dynamicRules.filter(r => !r.expiresAt || r.expiresAt > Date.now()),
            {
              id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              contactId,
              condition,
              action,
              enabled: true,
              createdAt: Date.now(),
              expiresAt,
            },
          ],
        },
      })),

      removeDynamicRule: (ruleId) => set(s => ({
        settings: {
          ...s.settings,
          dynamicRules: s.settings.dynamicRules.filter(r => r.id !== ruleId),
        },
      })),

      toggleDynamicRule: (ruleId) => set(s => ({
        settings: {
          ...s.settings,
          dynamicRules: s.settings.dynamicRules.map(r =>
            r.id === ruleId ? { ...r, enabled: !r.enabled } : r
          ),
        },
      })),

      updateDynamicRule: (ruleId, patch) => set(s => ({
        settings: {
          ...s.settings,
          dynamicRules: s.settings.dynamicRules.map(r =>
            r.id === ruleId ? { ...r, ...patch } : r
          ),
        },
      })),

      getDynamicRulesForContact: (contactId) => {
        const { settings } = get();
        const now = Date.now();
        return settings.dynamicRules.filter(r =>
          (r.contactId === contactId || r.contactId === '*') &&
          r.enabled &&
          (!r.expiresAt || r.expiresAt > now)
        );
      },

      addMemoryNote: (text, kind, expiresAt) => set(s => ({
        settings: {
          ...s.settings,
          memory: [
            ...(s.settings.memory ?? []).filter(n => !n.expiresAt || n.expiresAt > Date.now()),
            { id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, kind, createdAt: Date.now(), expiresAt },
          ],
        },
      })),

      forgetMemory: (target) => {
        const before = (get().settings.memory ?? []).length;
        set(s => ({
          settings: {
            ...s.settings,
            memory: target === 'all'
              ? []
              : (s.settings.memory ?? []).filter(n => !n.text.toLowerCase().includes(target.toLowerCase())),
          },
        }));
        return before - (get().settings.memory ?? []).length;
      },

      getActiveMemory: () => {
        const now = Date.now();
        return (get().settings.memory ?? []).filter(n => !n.expiresAt || n.expiresAt > now);
      },

      applyProfile: (profileId) => {
        const profile = PROFILES[profileId];
        if (!profile) return;
        set(s => ({
          settings: {
            ...s.settings,
            civility: { ...s.settings.civility, ...profile.settings.civility },
            spam: { ...s.settings.spam, ...profile.settings.spam },
            ...(profile.settings.dnd ? { dnd: { ...s.settings.dnd, ...profile.settings.dnd } } : {}),
            commander: { ...(s.settings.commander ?? { summaryStyle: 'casual' }), summaryStyle: profile.settings.summaryStyle, profile: profileId },
            dynamicRules: [
              // Hand-written rules survive; the previous profile's rules are replaced.
              ...s.settings.dynamicRules.filter(r => r.source !== 'profile'),
              ...profile.rules.map((r, i) => ({
                id: `profile-${profileId}-${i}`,
                contactId: '*',
                condition: r.condition,
                action: r.action,
                enabled: true,
                createdAt: Date.now(),
                source: 'profile',
              })),
            ],
          },
        }));
      },

      muteContact: (contactId, untilTs) => set(s => ({
        settings: { ...s.settings, mutes: { ...(s.settings.mutes ?? {}), [contactId]: untilTs } },
      })),

      unmuteContact: (contactId) => set(s => {
        const mutes = { ...(s.settings.mutes ?? {}) };
        delete mutes[contactId];
        return { settings: { ...s.settings, mutes } };
      }),

      checkAndReceiveMessage: async (contactId, text, route, verdict, apiKey, meta) => {
        // Import here to avoid circular dependencies
        const { checkRuleMatch } = await import('../moderation/rules-check');

        const state = get();
        const rules = state.getDynamicRulesForContact(contactId);

        let finalRoute = route;
        let finalVerdict = verdict;

        // Check each rule against the message
        for (const rule of rules) {
          try {
            const result = await checkRuleMatch(text, rule, apiKey);
            if (result.matches) {
              // If rule action is 'block' or 'review', hold the message
              if (rule.action === 'block' || rule.action === 'review') {
                finalRoute = { folder: 'review', status: 'held', ask: false };
                // Carry the rule + match reason so the Review UI can explain
                // exactly why this message was held.
                finalVerdict = {
                  ...verdict,
                  reason: `Matched your rule "${rule.condition}"${result.reason ? ` — ${result.reason}` : ''}`,
                };
                break;
              }
            }
          } catch (error) {
            console.error('Error checking rule match:', error);
            // Fall back to heuristic on error
          }
        }

        // Now call receiveMessage with potentially modified route
        state.receiveMessage(contactId, text, finalRoute, finalVerdict, meta);
        return finalRoute;
      },

      // Explicit demo entry: sample contacts/messages, onboarding pre-completed
      // so "Try Demo" drops straight into the app.
      loadDemoData: () => set({
        contacts: SEED_CONTACTS,
        messages: SEED_MESSAGES,
        settings: { ...DEFAULT_SETTINGS, trustedIds: ['dad'], _onboardingComplete: true },
        activeFolder: 'primary', activeContactId: null,
        pendingAsk: null, revealed: {}, banner: null,
      }),

      resetToSeed: () => set({
        currentUserId: null, currentUserPhone: null,
        contacts: SEED_CONTACTS, messages: SEED_MESSAGES,
        settings: { ...DEFAULT_SETTINGS, trustedIds: ['dad'], _onboardingComplete: true },
        activeScreen: 'chats', activeFolder: 'primary', activeContactId: null,
        pendingAsk: null, revealed: {}, banner: null,
      }),
    }),
    {
      // Key bump ('sift-v3' → 'strenes-v1') deliberately resets every existing
      // install to the new fresh-start state on update.
      name: 'strenes-v1',
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
