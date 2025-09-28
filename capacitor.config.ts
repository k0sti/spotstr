import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'space.nexel.spotstr',
  appName: 'Spotstr',
  webDir: 'dist',
  plugins: {
    SafeArea: {
      enabled: true,
      customColorsForSystemBars: false,
      statusBarColor: '#00000000',  // Transparent
      navigationBarColor: '#00000000'  // Transparent
    }
  }
};

export default config;
