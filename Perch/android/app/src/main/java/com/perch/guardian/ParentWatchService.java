package com.perch.guardian;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Instant alerts on the PARENT's phone. A foreground service (persistent
 * quiet notification) polls perch_fetch_events every 60s and posts a real
 * notification for each new flag — so the parent hears about a serious
 * flag within a minute, even with Perch closed. Survives reboot via
 * BootReceiver. No FCM / Google account required.
 */
public class ParentWatchService extends Service {

  static final String CH_WATCH = "perch_watch";
  static final String CH_ALERTS = "perch_alerts";
  private static final int WATCH_NOTIF_ID = 1;
  private static final long POLL_SECONDS = 60;

  private ScheduledExecutorService exec;

  @Override
  public void onCreate() {
    super.onCreate();
    createChannels();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    startForeground(WATCH_NOTIF_ID, watchNotification());
    if (exec == null || exec.isShutdown()) {
      exec = Executors.newSingleThreadScheduledExecutor();
      exec.scheduleWithFixedDelay(this::poll, 5, POLL_SECONDS, TimeUnit.SECONDS);
    }
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    if (exec != null) exec.shutdownNow();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }

  // ── Polling ───────────────────────────────────────────────────────────────

  private void poll() {
    EventStore store = new EventStore(this);
    if (!store.configured() || !store.parentWatchEnabled()) return;

    // First run: only alert on FUTURE flags, don't replay history.
    long lastSeen = store.lastSeenMs();
    if (lastSeen == 0) {
      store.setLastSeenMs(System.currentTimeMillis());
      return;
    }

    HttpURLConnection conn = null;
    try {
      JSONObject body = new JSONObject();
      body.put("p_pairing_id", store.pairingId());
      body.put("p_since_ms", lastSeen);

      conn = (HttpURLConnection) new URL(store.supabaseUrl() + "/rest/v1/rpc/perch_fetch_events").openConnection();
      conn.setRequestMethod("POST");
      conn.setConnectTimeout(15_000);
      conn.setReadTimeout(15_000);
      conn.setDoOutput(true);
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setRequestProperty("apikey", store.anonKey());
      conn.setRequestProperty("Authorization", "Bearer " + store.anonKey());
      try (OutputStream os = conn.getOutputStream()) {
        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
      }
      if (conn.getResponseCode() != 200) return;

      StringBuilder sb = new StringBuilder();
      try (BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
      }
      JSONArray rows = new JSONArray(sb.toString());
      long newest = lastSeen;
      // RPC returns newest-first; notify oldest-first so order reads naturally.
      for (int i = rows.length() - 1; i >= 0; i--) {
        JSONObject e = rows.getJSONObject(i);
        long at = e.optLong("at_ms", 0);
        if (at <= lastSeen) continue;
        notifyFlag(e);
        if (at > newest) newest = at;
      }
      if (newest > lastSeen) store.setLastSeenMs(newest);
    } catch (Exception ignored) {
      // Offline is normal; next tick retries.
    } finally {
      if (conn != null) conn.disconnect();
    }
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  private void notifyFlag(JSONObject e) {
    String severity = e.optString("severity", "watch");
    String category = e.optString("category", "");
    String sender = e.optString("sender", "someone");
    String app = e.optString("app", "a messaging app");
    String reason = e.optString("reason", "");
    String kid = new EventStore(this).kidAlias();
    boolean serious = "alert".equals(severity);

    String title = (serious ? "🚨 " : "⚠️ ") + "Perch: " + categoryLabel(category);
    String text = "Flag on " + (kid.isEmpty() ? "the protected phone" : kid + "'s phone")
      + " — from \"" + sender + "\" on " + app + ". " + reason + ".";

    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pi = PendingIntent.getActivity(this, 0, open,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

    Notification n = new NotificationCompat.Builder(this, CH_ALERTS)
      .setSmallIcon(getApplicationInfo().icon)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
      .setPriority(serious ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setAutoCancel(true)
      .setContentIntent(pi)
      .build();

    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    nm.notify(e.optString("id", String.valueOf(System.currentTimeMillis())).hashCode(), n);
  }

  private static String categoryLabel(String c) {
    switch (c) {
      case "grooming": return "Grooming / secrecy";
      case "photo-request": return "Photo request";
      case "meetup": return "Meet-up pressure";
      case "explicit": return "Explicit content";
      case "lure": return "Gift lure";
      case "scam": return "Scam";
      case "bullying": return "Bullying";
      case "self-harm": return "Self-harm mention";
      default: return "Flag";
    }
  }

  private Notification watchNotification() {
    Intent open = new Intent(this, MainActivity.class);
    PendingIntent pi = PendingIntent.getActivity(this, 0, open,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    return new NotificationCompat.Builder(this, CH_WATCH)
      .setSmallIcon(getApplicationInfo().icon)
      .setContentTitle("Perch is keeping watch 🦉")
      .setContentText("You'll be alerted the moment a flag arrives.")
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setContentIntent(pi)
      .build();
  }

  private void createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    NotificationChannel watch = new NotificationChannel(CH_WATCH, "Perch watch (quiet)", NotificationManager.IMPORTANCE_MIN);
    watch.setDescription("Persistent while instant alerts are on");
    nm.createNotificationChannel(watch);
    NotificationChannel alerts = new NotificationChannel(CH_ALERTS, "Perch flag alerts", NotificationManager.IMPORTANCE_HIGH);
    alerts.setDescription("A flag was raised on the protected phone");
    nm.createNotificationChannel(alerts);
  }

  // ── Helpers used by the plugin / boot receiver ────────────────────────────

  static void start(Context ctx) {
    Intent i = new Intent(ctx, ParentWatchService.class);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
    else ctx.startService(i);
  }

  static void stop(Context ctx) {
    ctx.stopService(new Intent(ctx, ParentWatchService.class));
  }
}
