---
title: 'Rate limits and size limits for the website APIs (hosting step 1)'
type: 'feature'
created: '2026-11-13'
status: 'done'
baseline_commit: '00766f44c9110fc457993333bd6dc022693afb45'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The website APIs accept unlimited requests and any body size. One person can flood city ratings (client-chosen device id), guess the admin password, overload the local Qwen model, or send huge messages and photos.

**Approach:** Per-IP limits on `/api/chat`, `/api/place-rating`, `/api/feedback` and failed `/api/admin/login` attempts, answered with 429 + `Retry-After`; size limits on bodies, message text and photos, answered with 413/400. The chat UI shows friendly English/Arabic messages.

## Boundaries & Constraints

**Always:**
- All limits live in one file with plain names, marked "estimate" (Bushra can change them):
  - chat: 20/minute and 300/day per IP;
  - place-rating: 20/hour per IP;
  - feedback: 30/hour per IP;
  - admin login: after 5 failed attempts in 15 minutes, 429 until the window passes;
  - bodies: chat 4 MB, place-rating 4 KB, feedback 32 KB, admin 4 KB;
  - chat message text: 4,000 characters per message;
  - photos: JPEG, PNG or WebP data URLs only, 1.5 MB each, at most 2 per request.
- Bodies are read with a byte cap (not only the Content-Length header).
- A blocked or rejected request never reaches the model or storage.
- Existing behaviour under the limits is unchanged (tests and eval still pass).

**Never:** accounts or CAPTCHA; an external rate-limit service (none chosen yet); limits on `/admin` page loads or `/api/admin/summary` and `/api/admin/label` (already cookie-gated).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Under limit | 20th chat in a minute | Normal answer | N/A |
| Chat flood | 21st chat in a minute from one IP | 429, `Retry-After` seconds | UI: "Too many messages. Please wait a minute." (EN/AR) |
| Other IP | Same moment, different IP | Normal answer | N/A |
| Window passes | After the minute | Allowed again | N/A |
| Rating flood | 21st rating in an hour | 429 | UI flash: "Too many ratings…" |
| Login guessing | 6th failed login in 15 min | 429, even with the right password | Admin page shows wait message |
| Login success | Right password before 5 fails | 200; success does not count | N/A |
| Big body | Chat body > 4 MB; rating > 4 KB | 413 | UI: "Message too large" |
| Long message | 4,001-character message | 400 | UI: "Message too long (max 4,000)" |
| Bad photo | GIF/SVG data URL, > 1.5 MB, or 3 photos | 400 | UI: "Photo too large or not supported" |

</frozen-after-approval>

## Code Map

- `website/app/api/chat/route.ts` -- `POST`: `req.json()`, `messages.slice(-12)`, images as `data:image/...;base64` in `m.image`.
- `website/app/api/place-rating/route.ts`, `app/api/feedback/route.ts`, `app/api/admin/login/route.ts` -- `req.json()` entry points.
- `website/components/Chat.tsx` -- `runAssistant` (~L172) assumes an NDJSON body (no `res.ok` check); `sendFeedback` (~L282); `resizeImage` makes 1024px JPEG 0.85.
- `website/components/PlaceRating.tsx` -- `submit()` flashes `t.rateError` on non-OK.
- `website/app/admin/page.tsx` -- `login()` treats every non-OK as "Wrong password".
- `website/lib/i18n.ts` -- strings.
- `website/lib/ratings/routes.test.ts` -- pattern for route tests (`POST(new Request(...))`).

## Tasks & Acceptance

**Execution:**
- [x] `website/lib/limits.ts` -- `LIMITS` (all numbers above), `clientIp(req)`, in-memory sliding-window `hit(key, max, windowMs)` → `{ ok, retryAfter }`, `tooMany(retryAfter)` 429 response, `readJson(req, maxBytes)` → value or 413/400 `Response`; periodic cleanup of old keys.
- [x] `website/app/api/chat/route.ts` -- body cap, rate check, message length and photo checks before search.
- [x] `website/app/api/place-rating/route.ts`, `app/api/feedback/route.ts` -- body cap + rate check.
- [x] `website/app/api/admin/login/route.ts` -- body cap; count failed attempts per IP; 429 when over.
- [x] `website/components/Chat.tsx`, `PlaceRating.tsx`, `app/admin/page.tsx`, `lib/i18n.ts` -- show the matrix messages for 429/413/400.
- [x] `website/lib/limits.test.ts` -- matrix rows through the routes and the limiter (fake clock).
- [x] `website/README.md`, `_bmad-output/implementation-artifacts/deferred-work.md` -- document limits; mark the rate-limit deferred item done.

**Acceptance Criteria:**
- Given 25 chat requests in one minute from one IP, when they are sent, then 20 get answers and 5 get 429 with `Retry-After`, and the model is called 20 times at most.

## Design Notes

In-memory limits work per server process. That fits this Mac and a single server; with several serverless instances each keeps its own counts. Move the counters to Supabase or Redis when hosting is chosen. IP = first `x-forwarded-for` entry, else `x-real-ip`, else `"local"`; behind a proxy that sets these headers.

## Verification

**Commands:**
- `cd website && npx tsx --test "lib/**/*.test.ts"` -- expected: all pass
- `cd website && npm run eval` -- expected: 82/82
- `cd website && npx tsc --noEmit && npm run lint` -- expected: no errors

## Implementation Notes

- Implemented directly in the main session, 13 Nov 2026.
- The chat client sends only the 2 newest photos (`withLatestPhotos`), so a chat with more photos never hits the 3-photo 400. The chat input has `maxLength=4000`.
- The 4,000-character limit applies to user messages only; long assistant answers in the history are allowed (the 4 MB body cap still applies).
- Login: blocked IPs get 429 before the password is checked; only wrong passwords count.
- After review: right-most IP (`TRUST_PROXY_HOPS`), login slot reserved before `await`, rate check before body read, roles checked, decoded photo size, shared `lib/limits-config.ts`. 87/87 tests, eval 82/82, `next build` OK.
- Verified before review: 83/83 tests (9 new in `lib/limits.test.ts`, every matrix row), eval 82/82, tsc and lint clean (2 old `<img>` warnings).

## Spec Change Log

## Review Triage Log

Review pass 1 (blind-hunter, edge-case-hunter, verification-gap), 13 Nov 2026.

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | IP from the left-most `x-forwarded-for` entry can be faked | high | the client writes the left entries; proxies append on the right | patch: right-most entry, `TRUST_PROXY_HOPS` (default 1) |
| 2 | No proxy headers → everyone shares "local"; one person can lock out admin | medium | true on this Mac; depends on hosting | defer (set with hosting) |
| 3 | Parallel wrong logins all pass the check-only gate | medium | gate checked, then `await`, then recorded | patch: reserve slot synchronously, `release()` on success |
| 4 | Chat body read and parsed before the rate check; rejects not counted | medium | `readJson` ran first | patch: rate check first in chat, rating, feedback |
| 5 | Client can send `role: "system"`; assistant history uncapped | medium | roles passed straight to Ollama | patch: only user/assistant; history ≤ 20,000 characters |
| 6 | Limiter memory grows (sweep only after 1 day; empty keys on checks) | medium | `recent()` stored empty arrays | patch: per-key window sweep, no empty keys, 100,000-key cap |
| 7 | Photo size measured as base64 text (real cap about 1.1 MB) | low | `image.length` | patch: decoded size |
| 8 | Chat 429 says "wait a minute" for the daily limit | low | fixed text | patch: `Retry-After` > 120 s → "try again tomorrow" |
| 9 | Admin wait time NaN for a non-number `Retry-After` | low | `Number()` of a date | patch: fallback to 15 min |
| 10 | Client matched English server text; "Too many photos" showed "too large" | low | `startsWith` / regex | patch: shared `CHAT_ERRORS`, own message for too many photos |
| 11 | Generic error text not in i18n | low | hard-coded twice | patch: `t.genericError` |
| 12 | `admin/label` uses uncapped `req.json()` | low | cookie-gated; frozen intent excludes admin label limits | reject (out of intent) |
| 13 | README lockout wording wrong (sliding window) | low | doc | patch |
| 14 | record:false test proves nothing | low | test | patch |
| 15 | Tests overwrite env without restoring | low | test | patch: save and restore |
| 16 | Place-rating test skipped without index | false | the route needs the index (503 before validation), so the skip is right | reject |
| 17 | Missing tests: daily window, `withLatestPhotos`, concurrent logins, faked IP | medium | none existed | patch: all four added |
| 18 | Limit numbers copied in the client | low | `maxLength`, `slice(-12)`, photos 2 | patch: `lib/limits-config.ts` shared |
| 19 | null entries in `messages` → 500 | low | `m.content` on null | patch: 400 |
| 20 | Server text vs client prefix untested | medium | route test checked only status | patch: route test checks exact text |
| 21 | Client 429/413 branches untested | medium | no component test setup | defer (with the earlier client-test item) |
