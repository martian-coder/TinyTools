package com.perch.guardian;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Tiny on-device log for the watcher: flagged events (metadata only),
 * the scanned-today counter, and the watcher's relay configuration.
 * SharedPreferences is plenty at this volume (log is capped at 300).
 */
final class EventStore {

  private static final String PREFS = "perch_watcher";
  private static final int MAX_EVENTS = 300;

  private final SharedPreferences prefs;

  EventStore(Context ctx) {
    prefs = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  // ── Relay configuration (set from the webview at pairing time) ────────────

  void configure(String pairingId, String supabaseUrl, String anonKey) {
    prefs.edit()
      .putString("pairingId", pairingId)
      .putString("supabaseUrl", supabaseUrl)
      .putString("anonKey", anonKey)
      .apply();
  }

  String pairingId()   { return prefs.getString("pairingId", null); }
  String supabaseUrl() { return prefs.getString("supabaseUrl", null); }
  String anonKey()     { return prefs.getString("anonKey", null); }

  boolean configured() {
    return pairingId() != null && supabaseUrl() != null && anonKey() != null;
  }

  // ── Parent-side instant alerts (ParentWatchService) ───────────────────────

  void setParentWatch(boolean enabled, String kidAlias) {
    prefs.edit()
      .putBoolean("parentWatch", enabled)
      .putString("kidAlias", kidAlias == null ? "" : kidAlias)
      .apply();
  }

  boolean parentWatchEnabled() { return prefs.getBoolean("parentWatch", false); }
  String kidAlias()            { return prefs.getString("kidAlias", ""); }

  long lastSeenMs() { return prefs.getLong("lastSeenMs", 0); }
  void setLastSeenMs(long t) { prefs.edit().putLong("lastSeenMs", t).apply(); }

  // ── Flag log ──────────────────────────────────────────────────────────────

  synchronized void addEvent(JSONObject event) {
    try {
      JSONArray log = events();
      log.put(event);
      // Cap: keep the newest MAX_EVENTS entries.
      if (log.length() > MAX_EVENTS) {
        JSONArray trimmed = new JSONArray();
        for (int i = log.length() - MAX_EVENTS; i < log.length(); i++) {
          trimmed.put(log.get(i));
        }
        log = trimmed;
      }
      prefs.edit()
        .putString("events", log.toString())
        .putLong("flaggedTotal", prefs.getLong("flaggedTotal", 0) + 1)
        .apply();
    } catch (Exception ignored) { /* a full disk must never crash the listener */ }
  }

  synchronized JSONArray events() {
    try {
      return new JSONArray(prefs.getString("events", "[]"));
    } catch (Exception e) {
      return new JSONArray();
    }
  }

  long flaggedTotal() { return prefs.getLong("flaggedTotal", 0); }

  // ── Scanned-today counter (transparency screen) ───────────────────────────

  private static String today() {
    return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
  }

  synchronized void bumpScanned() {
    String day = today();
    if (!day.equals(prefs.getString("scanDay", ""))) {
      prefs.edit().putString("scanDay", day).putLong("scanCount", 1).apply();
    } else {
      prefs.edit().putLong("scanCount", prefs.getLong("scanCount", 0) + 1).apply();
    }
  }

  synchronized long scannedToday() {
    return today().equals(prefs.getString("scanDay", "")) ? prefs.getLong("scanCount", 0) : 0;
  }

  // ── Dedupe (notification updates re-post the same text) ──────────────────

  synchronized boolean seenRecently(String fingerprint, long windowMs) {
    long now = System.currentTimeMillis();
    try {
      JSONObject seen = new JSONObject(prefs.getString("seen", "{}"));
      // Prune old fingerprints while we're here.
      JSONObject fresh = new JSONObject();
      for (java.util.Iterator<String> it = seen.keys(); it.hasNext(); ) {
        String k = it.next();
        long t = seen.optLong(k, 0);
        if (now - t < windowMs) fresh.put(k, t);
      }
      boolean dup = fresh.has(fingerprint);
      fresh.put(fingerprint, now);
      prefs.edit().putString("seen", fresh.toString()).apply();
      return dup;
    } catch (Exception e) {
      return false;
    }
  }
}
