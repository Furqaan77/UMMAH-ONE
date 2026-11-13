---
title: 'City enjoyment ratings: user input in chat, team decides the label'
type: 'feature'
created: '2026-11-13'
status: 'done'
baseline_commit: '1d8875a799f4151ff4c7eca146ad1bbb41976a19'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ummah One wants to tell travellers how enjoyable each of the 81 cities is, but the labels must come from the team (Bushra), informed by real visitors. Today there is no way to collect visitor feelings or publish a team label.

**Approach:** Under chat answers about one travel city, visitors who tick "I have been to [city]" pick one of 4 labels (Very boring, Boring, Enjoyable, Most enjoyable) with an optional comment. Inputs are stored privately. A password-protected admin page shows per-city counts and comments; Bushra sets or clears each city's label by hand. Only approved labels are shown in chat and given to the chatbot.

## Boundaries & Constraints

**Always:**
- No city has a label at start. Labels change only through the admin page. Nothing is automatic.
- User inputs are never shown publicly or sent to the chat model.
- Only the 81 travel cities can be rated. The "visited" tick is required (server rejects without it).
- One rating per city per device; a new rating from the same device replaces the old one.
- Storage follows `app/api/feedback/route.ts`: Supabase (service role) when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, else files in `website/.data/`.
- English and Arabic UI strings.

**Never:** Expo app changes; login/accounts; showing vote counts publicly; auto-labelling; the model inventing a label for an unrated city.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rate | visited=true, city "Konya", label "enjoyable" | Saved; UI shows thanks | N/A |
| Not visited | visited=false | Not saved | 400 |
| Unknown city | city "Paris" or blocked place | Not saved | 400 |
| Bad label / long comment | label "great"; comment > 500 chars | Not saved / comment cut to 500 | 400 for bad label |
| Same device again | second rating, same city | Replaces the first | N/A |
| Admin, no password set | `ADMIN_PASSWORD` empty | Admin disabled | 503 |
| Admin, wrong password | login | No access | 401 |
| Chat, unrated city | "Tell me about Konya" | Rating box; no label shown | N/A |
| Chat, approved city | label set to "enjoyable" | "Ummah One rating: Enjoyable" + box | N/A |
| Chat, several or no cities | "Compare Bodrum and Fethiye" | No box, no badge | N/A |

</frozen-after-approval>

## Code Map

- `website/app/api/feedback/route.ts` -- pattern to copy: Supabase REST insert, else append to `.data/*.jsonl`.
- `website/app/api/chat/route.ts` -- `search()` returns `places`; stream sends ndjson events (`sources`, `text`, `error`); `systemPrompt(context, lang)` builds rules.
- `website/lib/rag/search.ts` -- `loadIndex()`, `detectPlaces`; travel cities = distinct `meta.city` of `category === "travel"` chunks (81, canonical names like "Cappadocia (Göreme)").
- `website/lib/rag/blocked.ts` -- `findBlocked()`.
- `website/components/Chat.tsx` -- `Message` type, ndjson reader (~L190), actions row (~L399); `load`/`save` localStorage helpers.
- `website/lib/i18n.ts` -- `T.en` / `T.ar` strings.
- `website/app/globals.css` -- reuse existing tokens/classes (`.icon-btn`, `.note`).
- `supabase/schema.sql` -- add tables; RLS on, no policies (service role only), like `feedback`.
- Do not change search ranking, ingest, or the data files.

## Tasks & Acceptance

**Execution:**
- [x] `website/lib/ratings/labels.ts` -- `LABELS` (`very_boring|boring|enjoyable|most_enjoyable`), en/ar names, `isLabel()`.
- [x] `website/lib/ratings/store.ts` -- `addRating`, `listRatings`, `summary()` (per city: counts, comments), `getLabels()`, `setLabel(city, label|null)`; Supabase or `.data/place-ratings.jsonl` + `.data/place-labels.json`; upsert by (device_id, city).
- [x] `website/lib/ratings/cities.ts` -- `travelCities()` from the index; `ratableCity(places)` = the single detected city if it is a travel city, else null.
- [x] `website/lib/ratings/admin-auth.ts` -- HMAC cookie token from `ADMIN_PASSWORD`, timing-safe check.
- [x] `website/app/api/place-rating/route.ts` -- POST, validate per matrix, save.
- [x] `website/app/api/admin/{login,summary,label}/route.ts` -- login sets httpOnly cookie; summary GET; label POST set/clear.
- [x] `website/app/admin/page.tsx` -- login form; table of 81 cities: counts per label, comments, current label, 4 set buttons + clear.
- [x] `website/app/api/chat/route.ts` -- send `{type:"place", city, label|null}` when ratable; add approved labels and rule to system prompt.
- [x] `website/components/Chat.tsx` + `lib/i18n.ts` + `globals.css` -- badge and rating box (visited tick, 4 buttons disabled until ticked, optional comment, send); device id in localStorage; "You rated…" after sending.
- [x] `supabase/schema.sql`, `.env.example`, `README.md` -- tables `place_ratings` (unique device_id+city) and `place_labels`; `ADMIN_PASSWORD`; how to review.
- [x] `website/lib/ratings/*.test.ts` -- matrix cases for validation, local store upsert, labels, auth.

**Acceptance Criteria:**
- Given no labels set, when a user asks "Which places are most enjoyable?", then the chatbot says no city has been rated yet by the team.
- Given Bushra sets Konya to "Most enjoyable" in admin, when a user asks that question, then the answer names Konya and the Konya answer shows the badge.
- Given ratings exist, when Bushra opens `/admin`, then each city shows counts per label and comments; the public site shows none of them.

## Design Notes

System prompt addition: `ENJOYMENT LABELS (set by the Ummah One team only): Konya: Most enjoyable …` or `No city has an enjoyment label yet.` Rule: use only these; for any other city say it has not been rated yet; never call a place boring or enjoyable on your own.

## Verification

**Commands:**
- `cd website && npx tsx --test "lib/**/*.test.ts"` -- expected: all pass
- `cd website && npm run eval` -- expected: 82/82
- `cd website && npx tsc --noEmit && npm run lint` -- expected: no errors

**Manual checks (if no CLI):**
- `npm run dev`: ask about Konya, rate it, see it in `/admin`, set a label, see the badge.

## Implementation Notes

- Implemented directly in the main session (no subagent), 13 Nov 2026.
- Local storage is `.data/place-ratings.json` (a JSON array, so a repeat rating from the same device can replace the old one) and `.data/place-labels.json`, not a `.jsonl` file.
- Labels are given to the model as context entry `[0]` (not as a separate rules block), plus `LABEL_RULE` in RULES. Reason: in the first live test the 4B model gave Bodrum (unrated) a label and added "I don't have that information" after a correct answer. Now the entry also states the asked-about city's status ("NOT rated yet").
- Old chat messages keep the badge they were sent with; a label changed later shows on new answers.
- Verified: 66/66 unit tests (9 new), eval 82/82, `tsc` and lint clean (2 old `<img>` warnings). Live via `next dev`: rating 200; not visited, unknown city and bad label → 400; admin without cookie or with a wrong password → 401; summary lists 81 cities; `place` event without and with a label; none for "Compare Bodrum and Fethiye"; "Which places are most enjoyable?" with no labels → "The Ummah One team has not rated any city yet…".
- Not re-verified: model answers with labels set after the context change. Ollama stopped during testing (Metal could not start from the sandbox). Re-run when Ollama is open.
- 13 Nov, re-verified with Ollama: no labels → "not rated any city yet"; Konya labelled → named correctly (English and Arabic); Bodrum unrated → "The Ummah One team has not rated Bodrum yet." (added that reply to the asked-city line); normal questions unchanged.
- Test ratings and labels were deleted from `.data/`.

## Spec Change Log

## Review Triage Log

Review pass 1 (blind-hunter, edge-case-hunter, verification-gap), 13 Nov 2026.

| # | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | Admin login brute force: no throttling | medium | `login/route.ts` had no attempt limit | defer (rate limits, with #3) |
| 2 | Admin cookie static, never expires; length leak in compare; weak passwords allowed | medium | token was HMAC(password, constant); `same()` returned early on length | patch: issued-at in token, 12 h server check, hashed compare, min 12 chars |
| 3 | Vote stuffing: client-chosen deviceId, no rate limit | medium | server checks only the id's format | defer (needs a rate limiter; hosting step 1) |
| 4 | Storage blocked → new deviceId per submit | low | `deviceId()` returned a fresh random id | patch: keep one in-memory id |
| 5 | "Change" erases the earlier comment | low | a new rating replaces the row, by design ("replaces the old one" in frozen intent) | reject (intended) |
| 6 | File store: corrupt file read as empty, then overwritten | medium | `read()` swallowed every error | patch: only ENOENT means empty |
| 7 | File store: concurrent read-modify-write races, non-atomic write | low | real, but local fallback on one Mac; fix needs a queue | reject (unlikely; adds complexity) |
| 8 | Chat waits on labels before search; Supabase fetch has no timeout | medium | `getLabels()` awaited first; no signal | patch: parallel + 4 s timeout |
| 9 | Labels block in every prompt; `[0]` has no UI source; English names in Arabic answers | low | small cost; model does not cite numbers in UI | reject |
| 10 | Old chats show stale labels | medium | label saved in localStorage history | patch: saved chats keep city, drop label |
| 11 | Missing index → unhandled 500 in rating/admin routes; admin stuck on "Loading" | medium | `travelCities()` outside try; page never left loading state | patch: 503 with "run npm run ingest"; admin error state + retry |
| 12 | admin/label lacks `findBlocked` | false | ingest fails on a blocked heading (AD-8), so a blocked city cannot be a travel city | reject |
| 13 | Missing route, Supabase, chat-wiring tests | medium | verification-gap: no test imported routes or `SupabaseRatingStore` | patch: `routes.test.ts`, fetch-stub test, `buildContext` test |
| 14 | No visitor notice about comments | low | comments read by the team; no notice | patch: one-line note under the comment box |
| 15 | No index on `city`; no "who set label"; comment order differs by store | low | schema and `summarize` | patch: index + sort newest first; "who" rejected (single admin) |
| 16 | Comment cut mid-emoji or with NUL → Postgres error | low | `slice` on UTF-16 units | patch: cut by characters, strip NUL |
| 17 | Rating boxes for the same city not in sync | low | each box reads once on mount | reject (rare; cosmetic) |
| 18 | Accessibility: radio role without keys; colour-only state; unlabeled password | low | markup | patch: `aria-pressed` buttons, hidden label |
| 19 | null JSON body → TypeError 500 | low | `validateRating(null)` and destructuring null | patch: treat as empty → 400/401 |
| 20 | PostgREST 1,000-row cap truncates admin counts | medium | single `select` | patch: paging by 1,000 |
| 21 | Labels failing to load → model says "no city rated" | low | fallback was `{}` | patch: "ratings unavailable" context |
| 22 | Invalid stored label values reach prompt/badge | low | no filter | patch: `cleanLabels` |
| 23 | Labels for cities no longer in the travel list reach the model | low | no filter | patch: filter by travel cities |
| 24 | Ratings for renamed cities invisible in admin | low | `summarize` skips unknown cities | reject (rare) |
| 25 | localStorage `uo.rated` corrupt → crash | low | `JSON.parse("null")[city]` throws | patch: validate object and labels |
| 26 | Admin rapid clicks out of order | low | possible, rare | reject |
| 27 | Spec says `.jsonl`, code writes `.json` | low | deviation recorded in Implementation Notes | reject (fix would edit the spec) |
| 28 | Client `place` event contract untested | medium | no component test setup in the repo | defer |
