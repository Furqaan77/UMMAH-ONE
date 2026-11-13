import Constants from "expo-constants";

// The app uses the website's backend (/api/chat, /api/feedback), so both give the same answers.
// Order: EXPO_PUBLIC_API_URL → the Mac running Expo (same Wi-Fi, port 3000) → app.json extra.apiUrl
function resolveApiUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (__DEV__ && host) return `http://${host}:3000`;
  return ((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? "http://localhost:3000").replace(/\/$/, "");
}

export const API_URL = resolveApiUrl();
