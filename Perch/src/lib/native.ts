/**
 * native — JS bridge to the PerchWatcher Capacitor plugin (Android only).
 * On web / iOS every call resolves to safe "not supported" values so the
 * UI can degrade to demo/simulator behavior.
 *
 * The real work happens in android/…/NotificationWatcherService.java: it
 * keeps scanning + relaying flags even when this webview is closed. The
 * plugin surface here is just setup + transparency reads.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PerchEvent } from '../types';

export interface WatcherStats {
  /** Notifications scanned since midnight (local). */
  scannedToday: number;
  /** Flags raised total (all time, local log). */
  flagged: number;
}

interface PerchWatcherPlugin {
  /** Has the user granted notification access to Perch? */
  isEnabled(): Promise<{ enabled: boolean }>;
  /** Jump to Android's "Notification access" settings screen. */
  openSettings(): Promise<void>;
  /** Hand the watcher its pairing + relay credentials (stored in SharedPreferences). */
  configure(opts: {
    pairingId: string;
    supabaseUrl: string;
    anonKey: string;
  }): Promise<void>;
  /** Local transparency log — everything the watcher flagged on THIS phone. */
  getLocalEvents(): Promise<{ events: PerchEvent[] }>;
  getStats(): Promise<WatcherStats>;
  /** PARENT phone: start the instant-alerts foreground service (60s poll → notifications). */
  startParentWatch(opts: {
    pairingId: string;
    supabaseUrl: string;
    anonKey: string;
    kidAlias?: string;
  }): Promise<{ running: boolean; notificationsGranted: boolean }>;
  stopParentWatch(): Promise<void>;
  parentWatchRunning(): Promise<{ running: boolean }>;
}

const PerchWatcher = registerPlugin<PerchWatcherPlugin>('PerchWatcher');

export const isNativeAndroid = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function watcherEnabled(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try { return (await PerchWatcher.isEnabled()).enabled; } catch { return false; }
}

export async function openWatcherSettings(): Promise<void> {
  if (!isNativeAndroid()) return;
  try { await PerchWatcher.openSettings(); } catch { /* not fatal */ }
}

export async function configureWatcher(pairingId: string, supabaseUrl: string, anonKey: string): Promise<void> {
  if (!isNativeAndroid()) return;
  try { await PerchWatcher.configure({ pairingId, supabaseUrl, anonKey }); } catch { /* not fatal */ }
}

export async function watcherLocalEvents(): Promise<PerchEvent[]> {
  if (!isNativeAndroid()) return [];
  try { return (await PerchWatcher.getLocalEvents()).events ?? []; } catch { return []; }
}

export async function watcherStats(): Promise<WatcherStats> {
  if (!isNativeAndroid()) return { scannedToday: 0, flagged: 0 };
  try { return await PerchWatcher.getStats(); } catch { return { scannedToday: 0, flagged: 0 }; }
}

// ── Parent phone: instant alerts ─────────────────────────────────────────────

export async function startInstantAlerts(
  pairingId: string,
  supabaseUrl: string,
  anonKey: string,
  kidAlias: string,
): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const r = await PerchWatcher.startParentWatch({ pairingId, supabaseUrl, anonKey, kidAlias });
    return r.running;
  } catch {
    return false;
  }
}

export async function stopInstantAlerts(): Promise<void> {
  if (!isNativeAndroid()) return;
  try { await PerchWatcher.stopParentWatch(); } catch { /* not fatal */ }
}

export async function instantAlertsRunning(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try { return (await PerchWatcher.parentWatchRunning()).running; } catch { return false; }
}
