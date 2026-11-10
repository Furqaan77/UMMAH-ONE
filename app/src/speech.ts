// Voice input. Works in a development/production build. In Expo Go the native module
// is missing, so `speech` is null and the app shows "not supported".
type SpeechModule = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (o: { lang: string; interimResults: boolean }) => void;
  stop: () => void;
  addListener: (event: string, cb: (e: { results?: { transcript: string }[]; isFinal?: boolean }) => void) => { remove: () => void };
};

let mod: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require("expo-speech-recognition").ExpoSpeechRecognitionModule as SpeechModule;
} catch {
  mod = null;
}

export const speech = mod;
