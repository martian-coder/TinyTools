import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.strenes.app',
  appName: 'Strenes',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    // No SplashScreen config here — @capacitor/splash-screen (the plugin
    // this config would target) isn't installed, so it was silently doing
    // nothing. The native AndroidX SplashScreen theme (styles.xml) shows the
    // branded image briefly and auto-dismisses on its own; App.tsx's boot
    // screen is what actually holds the branded moment open for real.
    Keyboard: {
      // We drive keyboard avoidance ourselves via the keyboardWillShow/Hide
      // events (App.tsx sets a --kb-height CSS var from the real, native
      // keyboard height) — 'none' stops the plugin from ALSO resizing the
      // webview itself, which was fighting with MainActivity's own
      // edge-to-edge inset handling and causing a large dead gap above the
      // keyboard.
      resize: 'none',
    },
  },
};

export default config;
