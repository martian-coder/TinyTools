package com.perch.guardian;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Posts one flag (metadata only — never message content) to Supabase REST
 * so the paired parent's Perch can pick it up. Fire-and-forget on a single
 * background thread: a dead network must never affect the listener, and
 * the flag stays in the local EventStore regardless.
 */
final class Relay {

  private static final ExecutorService IO = Executors.newSingleThreadExecutor();

  static void postEvent(EventStore store, JSONObject event) {
    if (!store.configured()) return;
    final String url = store.supabaseUrl() + "/rest/v1/perch_events";
    final String key = store.anonKey();
    final String pairingId = store.pairingId();

    IO.execute(() -> {
      HttpURLConnection conn = null;
      try {
        JSONObject row = new JSONObject();
        row.put("id", event.getString("id"));
        row.put("pairing_id", pairingId);
        row.put("category", event.getString("category"));
        row.put("severity", event.getString("severity"));
        row.put("reason", event.getString("reason"));
        row.put("app", event.optString("app", ""));
        row.put("sender", event.optString("sender", ""));
        row.put("at_ms", event.getLong("at"));

        conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("POST");
        conn.setConnectTimeout(10_000);
        conn.setReadTimeout(10_000);
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("apikey", key);
        conn.setRequestProperty("Authorization", "Bearer " + key);
        conn.setRequestProperty("Prefer", "return=minimal");

        byte[] body = row.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream os = conn.getOutputStream()) {
          os.write(body);
        }
        conn.getResponseCode(); // drain; success or not, we move on
      } catch (Exception ignored) {
        // Offline is normal. The flag is already in the local log; the
        // parent will see it in person. (Retry queue: future work.)
      } finally {
        if (conn != null) conn.disconnect();
      }
    });
  }

  private Relay() {}
}
