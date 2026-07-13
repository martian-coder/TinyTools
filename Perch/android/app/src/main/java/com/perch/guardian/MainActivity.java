package com.perch.guardian;

import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Edge-to-edge inset fix carried over from Strenes: Android 15 (API 35+)
 * draws the WebView behind the system bars, and WebView ignores view
 * padding for page rendering — applying the insets as layout MARGINS
 * shrinks the WebView itself, which every Android version honors.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(PerchWatcherPlugin.class);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().getDecorView().setBackgroundColor(Color.parseColor("#0a120e"));
    ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (view, insets) -> {
      Insets bars = insets.getInsets(
          WindowInsetsCompat.Type.systemBars()
              | WindowInsetsCompat.Type.displayCutout()
              | WindowInsetsCompat.Type.ime());
      ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
      mlp.leftMargin = bars.left;
      mlp.topMargin = bars.top;
      mlp.rightMargin = bars.right;
      mlp.bottomMargin = bars.bottom;
      view.setLayoutParams(mlp);
      return WindowInsetsCompat.CONSUMED;
    });
  }
}
