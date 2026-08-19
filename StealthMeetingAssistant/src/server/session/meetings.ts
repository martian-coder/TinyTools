import crypto from 'node:crypto';
import { dataPath, readJson, writeJson } from '../config';

/**
 * Named, reusable meeting contexts — a daily standup, a weekly client call,
 * a project review.
 *
 * The point is recurrence. You write the brief once, and every subsequent
 * session opens already knowing what this meeting is. Each wrap-up stores a
 * short recap, so the next occurrence starts with what was outstanding last
 * time, which is what makes a follow-up call useful rather than a re-run.
 */
export interface MeetingProfile {
  id: string;
  name: string;
  /** Standing context the user wrote: who is in it, what it is for. */
  brief: string;
  /** Recap of the previous session — decisions and open items. */
  carryOver?: string;
  carryOverAt?: number;
  lastUsedAt?: number;
  createdAt: number;
}

interface MeetingStore {
  version: 1;
  meetings: MeetingProfile[];
  activeId?: string;
}

const EMPTY: MeetingStore = { version: 1, meetings: [] };

function file(): string {
  return dataPath('meetings.json');
}

function load(): MeetingStore {
  const store = readJson<MeetingStore>(file(), EMPTY);
  return { version: 1, meetings: store.meetings ?? [], activeId: store.activeId };
}

function save(store: MeetingStore): void {
  writeJson(file(), store);
}

export function listMeetings(): { meetings: MeetingProfile[]; activeId?: string } {
  const store = load();
  return {
    // Most recently used first: the meeting you are about to join is almost
    // always the one you were in yesterday.
    meetings: [...store.meetings].sort(
      (a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt),
    ),
    activeId: store.activeId,
  };
}

export function getMeeting(id: string | undefined): MeetingProfile | undefined {
  if (!id) return undefined;
  return load().meetings.find((m) => m.id === id);
}

export function activeMeeting(): MeetingProfile | undefined {
  return getMeeting(load().activeId);
}

export function upsertMeeting(input: {
  id?: string;
  name: string;
  brief?: string;
}): MeetingProfile {
  const name = input.name?.trim();
  if (!name) throw new Error('A meeting name is required');

  const store = load();
  const existing = input.id ? store.meetings.find((m) => m.id === input.id) : undefined;

  if (existing) {
    existing.name = name;
    existing.brief = (input.brief ?? existing.brief ?? '').slice(0, 8000);
    save(store);
    return existing;
  }

  const created: MeetingProfile = {
    id: crypto.randomUUID(),
    name,
    brief: (input.brief ?? '').slice(0, 8000),
    createdAt: Date.now(),
  };
  store.meetings.push(created);
  save(store);
  return created;
}

export function deleteMeeting(id: string): boolean {
  const store = load();
  const next = store.meetings.filter((m) => m.id !== id);
  if (next.length === store.meetings.length) return false;
  store.meetings = next;
  if (store.activeId === id) store.activeId = undefined;
  save(store);
  return true;
}

/** Select the meeting for this session. `undefined` clears the selection. */
export function activateMeeting(id: string | undefined): MeetingProfile | undefined {
  const store = load();
  if (!id) {
    store.activeId = undefined;
    save(store);
    return undefined;
  }
  const meeting = store.meetings.find((m) => m.id === id);
  if (!meeting) throw new Error('Meeting not found');
  // Millisecond resolution is coarse enough that two activations can land on
  // the same value, which would make "most recent first" arbitrary. Force it
  // strictly forward so the ordering is always deterministic.
  const newest = Math.max(0, ...store.meetings.map((m) => m.lastUsedAt ?? 0));
  meeting.lastUsedAt = Math.max(Date.now(), newest + 1);
  store.activeId = id;
  save(store);
  return meeting;
}

/**
 * Store the recap that the next session will open with.
 *
 * This text is derived from the meeting transcript, so downstream it is
 * treated as untrusted data and fenced like any other quoted content — never
 * folded into the system prompt the way the user's own brief is.
 */
export function setCarryOver(id: string, text: string): MeetingProfile {
  const store = load();
  const meeting = store.meetings.find((m) => m.id === id);
  if (!meeting) throw new Error('Meeting not found');
  meeting.carryOver = text.trim().slice(0, 4000);
  meeting.carryOverAt = Date.now();
  save(store);
  return meeting;
}
