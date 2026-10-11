import { ExpoConfig } from "expo/config";
const production = process.env.EAS_BUILD_PROFILE === "production";
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
if (
  production &&
  (!projectId || !process.env.EXPO_PUBLIC_API_URL?.startsWith("https://"))
)
  throw new Error(
    "Configurez EAS_PROJECT_ID et une API HTTPS avant un build de production.",
  );
const config: ExpoConfig = {
  name: "Midad",
  slug: "midad",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "midad",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "dz.midad.app",
    infoPlist: {
      NSLocalNetworkUsageDescription:
        "Connexion au serveur Midad local lors des tests.",
      ITSAppUsesNonExemptEncryption: false,
      ...(!production
        ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } }
        : {}),
    },
  },
  android: {
    package: "dz.midad.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive.png",
      backgroundColor: "#173d2c",
    },
    permissions: ["POST_NOTIFICATIONS"],
  },
  web: { favicon: "./assets/favicon.png" },
  plugins: [
    [
      "expo-build-properties",
      { android: { usesCleartextTraffic: !production } },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        imageWidth: 160,
        backgroundColor: "#173d2c",
      },
    ],
    "expo-secure-store",
    "expo-notifications",
    "expo-document-picker",
    "expo-sharing",
  ],
  extra: { ...(projectId ? { eas: { projectId } } : {}) },
};
export default config;
