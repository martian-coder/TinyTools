package com.strenes.app;

import android.os.Bundle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Android 15 (API 35+) forces edge-to-edge: the WebView draws behind the
 * status bar and navigation bar regardless of app opt-in. Without this, the
 * header renders under the status bar and the bottom nav pill sits under the
 * 3-button navigation bar. We apply the real system-bar insets as WebView
 * padding so the page's own safe-area layout (env(safe-area-inset-*) in CSS)
 * gets correct, non-zero values on every device — 3-button nav, gesture nav,
 * and notches alike.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, insets) -> {
      Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
      return insets;
    });
  }
}
