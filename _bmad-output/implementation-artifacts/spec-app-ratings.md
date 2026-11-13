---
title: 'Mobile app: city rating box and limit messages'
type: 'feature'
created: '2026-11-13'
status: 'done'
route: 'oneshot'
baseline_commit: '32fc81b'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The website shows the city rating box and friendly limit messages, but the Expo app (`app/`) ignores the chat's `place` event, cannot rate cities, and shows a generic error when a limit is hit (429/413/400).

**Approach:** Match the website in the app:
- Parse the `place` event. Under a finished answer about one travel city, show the team label badge ("Ummah One rating: X") when one is set, and the "How did [city] feel to you?" box:
  - tick "I have been to [city]";
  - pick Very boring, Boring, Enjoyable or Most enjoyable;
  - optional comment (500 characters);
  - POST to `/api/place-rating` with a device id kept in AsyncStorage;
  - "You rated …" afterwards, with "Change"; 429 shows "too many ratings".
- Saved chats keep the city but not the label.
- Chat errors: 429 shows the per-minute or the daily message (from `Retry-After`); 413 too large; 400 shows "message too long", "photo not supported" or "too many photos", matched to the server texts.
- Requests send only the last 12 messages and the 2 newest photos. The input is capped at 4,000 characters. A feedback 429 shows "too much feedback".
- English and Arabic strings. No server changes.

</frozen-after-approval>

## Implementation Notes

- Files: `app/App.tsx` (place event, error messages, photo/message caps, input `maxLength`, feedback 429, saved chats drop the label), new `app/src/PlaceRating.tsx` and `app/src/limits.ts`, `app/src/i18n.ts` (strings copied from the website).
- The app is a separate package, so the limit numbers, error texts and label names are copied into `app/src/limits.ts`. A new website test (`website/lib/app-sync.test.ts`) fails if the copies drift.
- Device id: random 32 characters in AsyncStorage (`uo.device`), with an in-memory fallback.
- Verified: `npx tsc --noEmit` in `app/` clean; website tests 89/89 (2 new); `expo export --platform ios` bundles. Web export needs `react-native-web`, which the app never had. Not run on a phone (no device here); test on the PC or a phone with Expo Go.

## Review Triage Log

Blind-hunter review, 13 Nov 2026.

- **medium · patch:** error messages were sent back to the model as history. Now filtered out, in the app (`historyForRequest`) and on the website.
- **low · patch:** answers over 20,000 characters would make every later request "Bad message". History answers are now capped, in the app and on the website.
- **medium · patch:** large phone photos (`quality: 0.5`, not resized) failed only after sending. The app now checks the size before attaching (`photoFits`). Downscaling deferred.
- **low · patch:** the daily-limit message used a fixed 120 s threshold. It now uses the minute window (60 s), in the app and on the website.
- **low · patch:** the sync test missed numbers written into strings. It now checks the app strings equal the website's (EN and AR) and that the numbers match the limits.
- **low · patch:** "Change" had no cancel. Added in the app and on the website.
- **low · patch:** no sign while a rating was being sent. Added dimming and `busy` state.
- **low · reject:** several boxes for the same city fall out of step (rare; same as the website review).
- **low · defer:** city names are not translated in Arabic (website too).
- **low · reject:** device id uses `Math.random` (not a security token); the privacy note doesn't mention it.
- **medium · defer:** no UI tests (covered by the existing deferred item).
- **low · reject:** `maxLength` cuts long text silently (the app is stricter than the server).
