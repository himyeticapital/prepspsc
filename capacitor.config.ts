import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.prepspsc.app",
  appName: "PrepSPSC",
  webDir: "out",
  server: {
    // For development, you can use your local IP
    // url: "http://192.168.1.x:3000",
    // cleartext: true,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#09090b",
      showSpinner: true,
      spinnerColor: "#2dd4bf",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    backgroundColor: "#09090b",
  },
};

export default config;
