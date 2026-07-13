package com.perch.guardian;

import android.content.ComponentName;
import android.content.Intent;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * PerchWatcher — the webview's window into the native watcher.
 * Setup (configure + open settings) and transparency reads only; the
 * scanning itself lives in NotificationWatcherService and needs no JS.
 */
@CapacitorPlugin(
  name = "PerchWatcher",
  permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class PerchWatcherPlugin extends Plugin {

  @PluginMethod
  public void isEnabled(PluginCall call) {
    boolean enabled = NotificationManagerCompat
      .getEnabledListenerPackages(getContext())
      .contains(getContext().getPackageName());
    JSObject ret = new JSObject();
    ret.put("enabled", enabled);
    call.resolve(ret);
  }

  @PluginMethod
  public void openSettings(PluginCall call) {
    Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
    // Deep-link straight to Perch's row where the OS supports it (API 30+).
    String cn = new ComponentName(getContext(), NotificationWatcherService.class).flattenToString();
    intent.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, cn);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
    call.resolve();
  }

  @PluginMethod
  public void configure(PluginCall call) {
    String pairingId = call.getString("pairingId");
    String supabaseUrl = call.getString("supabaseUrl");
    String anonKey = call.getString("anonKey");
    if (pairingId == null || supabaseUrl == null || anonKey == null) {
      call.reject("pairingId, supabaseUrl and anonKey are required");
      return;
    }
    new EventStore(getContext()).configure(pairingId, supabaseUrl, anonKey);
    call.resolve();
  }

  @PluginMethod
  public void getLocalEvents(PluginCall call) {
    EventStore store = new EventStore(getContext());
    JSArray events = new JSArray();
    try {
      JSONArray log = store.events();
      for (int i = 0; i < log.length(); i++) {
        JSONObject e = log.getJSONObject(i);
        JSObject o = new JSObject();
        o.put("id", e.optString("id"));
        o.put("category", e.optString("category"));
        o.put("severity", e.optString("severity"));
        o.put("reason", e.optString("reason"));
        o.put("app", e.optString("app"));
        o.put("sender", e.optString("sender"));
        o.put("at", e.optLong("at"));
        events.put(o);
      }
    } catch (Exception ignored) { /* empty list is a fine answer */ }
    JSObject ret = new JSObject();
    ret.put("events", events);
    call.resolve(ret);
  }

  // ── Parent-side instant alerts ─────────────────────────────────────────────

  @PluginMethod
  public void startParentWatch(PluginCall call) {
    String pairingId = call.getString("pairingId");
    String supabaseUrl = call.getString("supabaseUrl");
    String anonKey = call.getString("anonKey");
    if (pairingId == null || supabaseUrl == null || anonKey == null) {
      call.reject("pairingId, supabaseUrl and anonKey are required");
      return;
    }
    EventStore store = new EventStore(getContext());
    store.configure(pairingId, supabaseUrl, anonKey);
    store.setParentWatch(true, call.getString("kidAlias", ""));

    if (Build.VERSION.SDK_INT >= 33
        && getPermissionState("notifications") != PermissionState.GRANTED) {
      requestPermissionForAlias("notifications", call, "notifPermDone");
      return;
    }
    launchWatch(call);
  }

  @PermissionCallback
  private void notifPermDone(PluginCall call) {
    // Start either way — alerts are just muted until the user grants it.
    launchWatch(call);
  }

  private void launchWatch(PluginCall call) {
    ParentWatchService.start(getContext());
    JSObject ret = new JSObject();
    ret.put("running", true);
    ret.put("notificationsGranted",
      Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
    call.resolve(ret);
  }

  @PluginMethod
  public void stopParentWatch(PluginCall call) {
    new EventStore(getContext()).setParentWatch(false, null);
    ParentWatchService.stop(getContext());
    call.resolve();
  }

  @PluginMethod
  public void parentWatchRunning(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("running", new EventStore(getContext()).parentWatchEnabled());
    call.resolve(ret);
  }

  @PluginMethod
  public void getStats(PluginCall call) {
    EventStore store = new EventStore(getContext());
    JSObject ret = new JSObject();
    ret.put("scannedToday", store.scannedToday());
    ret.put("flagged", store.flaggedTotal());
    call.resolve(ret);
  }
}
