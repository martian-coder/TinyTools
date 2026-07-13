import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.perch.guardian',
  appName: 'Perch',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0a120e',
    },
  },
};

export default config;
