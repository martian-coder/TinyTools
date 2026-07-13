package com.perch.guardian;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * The watcher — Perch's always-on core. Android delivers every posted
 * notification here (once the user grants notification access); we scan
 * the text of messaging apps ON-DEVICE with Detection and, on a hit,
 * store the flag locally and relay its METADATA to the paired parent.
 *
 * The full notification text never leaves this method. No content is
 * logged, stored, or transmitted — only category/reason/app/sender/time.
 */
public class NotificationWatcherService extends NotificationListenerService {

  /** Apps we scan (package → label). Mirrors WATCHED_APPS in engine.ts. */
  private static final Map<String, String> WATCHED = new HashMap<>();
  static {
    WATCHED.put("com.whatsapp", "WhatsApp");
    WATCHED.put("com.whatsapp.w4b", "WhatsApp Business");
    WATCHED.put("com.instagram.android", "Instagram");
    WATCHED.put("com.snapchat.android", "Snapchat");
    WATCHED.put("org.telegram.messenger", "Telegram");
    WATCHED.put("com.discord", "Discord");
    WATCHED.put("com.facebook.orca", "Messenger");
    WATCHED.put("com.google.android.apps.messaging", "Messages (SMS)");
    WATCHED.put("com.samsung.android.messaging", "Messages (SMS)");
    WATCHED.put("kik.android", "Kik");
    WATCHED.put("com.strenes.app", "Strenes");
  }

  /** Ignore a repeated identical notification within this window. */
  private static final long DEDUPE_WINDOW_MS = 10 * 60 * 1000;

  @Override
  public void onNotificationPosted(StatusBarNotification sbn) {
    try {
      String pkg = sbn.getPackageName();
      String appLabel = WATCHED.get(pkg);
      if (appLabel == null) return;                      // not a watched app
      if (getPackageName().equals(pkg)) return;          // never scan ourselves

      Notification n = sbn.getNotification();
      if (n == null) return;
      // Skip group summaries — the child notifications carry the real text.
      if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;

      Bundle extras = n.extras;
      if (extras == null) return;

      CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
      CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
      if (textCs == null) textCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
      String sender = titleCs != null ? titleCs.toString() : appLabel;
      String text = textCs != null ? textCs.toString() : "";
      if (text.isEmpty()) return;

      EventStore store = new EventStore(this);
      store.bumpScanned();

      Detection.Hit hit = Detection.detect(text);
      if (hit == null) return;

      // Same sender + same text within the window = a notification update.
      String fingerprint = Integer.toHexString((pkg + "|" + sender + "|" + text).hashCode());
      if (store.seenRecently(fingerprint, DEDUPE_WINDOW_MS)) return;

      JSONObject event = new JSONObject();
      event.put("id", UUID.randomUUID().toString());
      event.put("category", hit.category);
      event.put("severity", hit.severity);
      event.put("reason", hit.reason);
      event.put("app", appLabel);
      event.put("sender", sender);
      event.put("at", System.currentTimeMillis());

      store.addEvent(event);
      Relay.postEvent(store, event);
    } catch (Exception ignored) {
      // The listener must never crash — Android would kill our access.
    }
  }
}
