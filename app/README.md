# Ummah One — Mobile app (iPhone + Android)

React Native + Expo (TypeScript). Same chat design as the website.
The app uses the website's backend (`/api/chat`, `/api/feedback`), so the **website must be running**.

## Run it on your phone

1. Start Ollama and the website (see `../website/README.md`).
2. Start the app:
   ```
   cd app
   npm install
   npx expo start
   ```
3. Install **Expo Go** on your phone, then scan the QR code. Your phone and Mac must be on the same Wi-Fi.
   The app finds the website automatically at `http://<your Mac's IP>:3000`.

To point at another server: `EXPO_PUBLIC_API_URL=https://example.com npx expo start`

## Voice input
The mic needs a native module, so it does not work in Expo Go (the app shows "not supported").
It works in a development build: `npx expo run:ios` or `npx expo run:android` (needs Xcode / Android Studio).

## Files

| File | What it does |
|---|---|
| `App.tsx` | The whole chat screen |
| `src/theme.ts` | Design tokens (same colours as the website) |
| `src/Icons.tsx` | Icons |
| `src/Answer.tsx` | Shows answers: paragraphs, lists, bold |
| `src/i18n.ts` | English and Arabic text (copy of `website/lib/i18n.ts`) |
| `src/config.ts` | Where the backend is |
| `src/speech.ts` | Voice input |
