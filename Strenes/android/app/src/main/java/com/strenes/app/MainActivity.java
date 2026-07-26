package com.strenes.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Android 15 (API 35+) forces edge-to-edge: the WebView draws behind the
 * status bar and navigation bar regardless of app opt-in. WebView does not
 * honor view padding for page rendering, so the previous padding-based fix
 * still left the bottom nav pill under the system navigation bar. Applying
 * the insets as layout MARGINS shrinks the WebView itself, which every
 * Android version honors.
 *
 * IME (on-screen keyboard) is deliberately EXCLUDED from this mask. Two
 * earlier attempts to also shrink the WebView for the keyboard here (via
 * this margin, and separately via windowSoftInputMode) both left a large
 * dead gap above the keyboard — relying on the WebView's resized bounds to
 * correctly propagate into CSS viewport units (vh/dvh) isn't reliable
 * across WebView versions. Keyboard avoidance is now handled entirely by
 * @capacitor/keyboard's native keyboardWillShow/Hide events (see App.tsx),
 * which report the real keyboard height directly with no dependency on
 * WebView relayout timing.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    // The strip behind the system bars shows the window background — match
    // the app's dark base so it reads as intentional chrome.
    getWindow().getDecorView().setBackgroundColor(Color.parseColor("#0b1020"));
    ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, insets) -> {
      Insets bars = insets.getInsets(
          WindowInsetsCompat.Type.systemBars()
              | WindowInsetsCompat.Type.displayCutout());
      ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
      mlp.leftMargin = bars.left;
      mlp.topMargin = bars.top;
      mlp.rightMargin = bars.right;
      mlp.bottomMargin = bars.bottom;
      view.setLayoutParams(mlp);
      return insets;
    });
  }
}
