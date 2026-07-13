package com.perch.guardian;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-arm instant alerts after a reboot, if the parent left them on. */
public class BootReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
    EventStore store = new EventStore(context);
    if (store.configured() && store.parentWatchEnabled()) {
      try {
        ParentWatchService.start(context);
      } catch (Exception ignored) {
        // Some OEMs restrict FGS-from-boot; the service re-arms next app open.
      }
    }
  }
}
