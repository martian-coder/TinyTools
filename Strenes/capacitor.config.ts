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
    SplashScreen: {
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0b1020',
    },
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
