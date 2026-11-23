---
title: 'Admin review of guide-check answers (Mr Tanveer approves, Bushra publishes)'
type: 'feature'
created: '2026-11-17'
status: 'done'
baseline_commit: 'ebf5a5bc0234a77cd5e0c0c3c51d63b81b1d0ed5'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tester answers from /check are saved to `.data/guide-check.jsonl`, but nobody can review them, and there is no record of what was approved. Nothing may enter the chatbot data (the "brain") without Mr Tanveer's approval and then Bushra's final check.

**Approach:** A password-protected review page at `/admin/guide`. It groups answers by city and guide item, shows how testers marked each item and their free-text notes, and lets the reviewer Approve or Reject each item, with an optional "what the guide should say" text. Decisions go to an append-only log. Approved items are listed as "waiting for Bushra to publish". Publishing stays manual (Bushra or Claude edits `website/data/`), so this feature never writes to the chatbot data.

Decisions (Bushra, 17 Nov 2026):
- Login: one password, the existing `ADMIN_PASSWORD` (option a).
- Publishing: Mr Tanveer approves, then Bushra (or Claude, with her confirmation) checks and publishes (option b).

## Boundaries & Constraints

**Always:**
- Reuse the existing admin login (`/api/admin/login`, cookie check).
- Every admin API checks the cookie (401 without it, 503 when admin is off).
- Decisions are appended, never rewritten; the latest decision for an item wins.
- Show the tester's text exactly as written, rendered as text (no HTML).
- The page is noindex, and its texts are simple English.

**Never:**
- Write to `website/data/`, `.data/index.json`, or run ingest.
- Change or delete `guide-check.jsonl`.
- Show or store any IP address or tester identity.
- Change the public `/check` form or the existing ratings `/admin` page, apart from one link between the two pages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| No answers yet | jsonl missing or empty | Page says "No answers yet" | N/A |
| Grouped counts | 3 answers mark Kok-Tobe "correct", 1 "closed" | Kok-Tobe row: Correct 3, Not open 1 | N/A |
| Free text | thingsMissing "Add Charyn Canyon" | Listed under the city's notes with date and part | N/A |
| Approve with text | POST {key, decision:"approved", text} | Appended to log; item shows Approved and appears in "Waiting to publish" | N/A |
| Change mind | Reject after Approve | Latest wins; item leaves "Waiting to publish" | N/A |
| Not logged in | No/expired cookie | 401; page shows login | N/A |
| Bad input | Unknown key, bad decision, text over 2,000 chars | 400 | Nothing is written |
| Broken line | A malformed jsonl line | Skipped; other answers still shown | Logged to the server console |

</frozen-after-approval>

## Code Map

- `website/app/api/guide-check/route.ts` -- the row shape: things/buy/ease `{item, mark}[]`, halal, feel, notes thingsMissing/buyMissing/halalNote/easeMissing/more, plus `at`, `lang`, `city`, `country`, `visit`. Read only.
- `website/lib/guide-check/strings.ts` -- CHECK_T.en mark names (reuse for labels).
- `website/lib/ratings/admin-auth.ts` -- `checkCookie`, `deny`. Reuse.
- `website/app/admin/page.tsx` -- the existing ratings admin; copy its login and state pattern. Add only a link to /admin/guide.
- `website/lib/limits.ts`, `website/lib/limits-config.ts` -- `readJson` and `LIMITS.body.admin` (4 KB) for the POST body.
- `website/app/globals.css` -- `.admin*` styles; reuse them and add a few `.rv-*` styles.

## Tasks & Acceptance

**Execution:**
- [x] `website/lib/guide-check/review.ts` -- pure `summarizeAnswers(rows, decisions)`: per city, the items (kind thing/buy/ease) with counts per mark, halal counts, feel counts, notes (part, text, date, lang), and each key's latest decision. Stable keys: `city|kind|item` for items; `city|note|<at>|<part>` for notes. Also file helpers to read the answers and decisions jsonl (skipping bad lines) and to append a decision -- keeps the logic testable.
- [x] `website/app/api/admin/guide-check/route.ts` -- GET: summary (cookie, no-store). POST: validate the key against the current summary, the decision (approved/rejected) and text (max 2,000), then append `{at, key, decision, text}` to `.data/guide-check-decisions.jsonl`.
- [x] `website/app/admin/guide/page.tsx` -- client page: login, filter (All / Needs decision / Approved / Rejected), city sections with an item table (marks, decision chips, optional text) and notes; a "Waiting to publish" list at the top; noindex.
- [x] `website/app/admin/page.tsx` -- add a link to /admin/guide.
- [x] `website/app/globals.css` -- minimal `.rv-*` styles.
- [x] `website/lib/guide-check/review.test.ts` -- unit tests for the matrix (grouping, latest decision wins, bad lines, notes keys).

**Acceptance Criteria:**
- Given 3 real answers in the jsonl, when the admin opens /admin/guide, then Almaty shows each item with the correct counts.
- Given an approved item, when the page reloads, then it is still approved and listed under "Waiting to publish".
- Given any decision, then `website/data/` and `.data/index.json` are unchanged.

## Implementation Notes

- Implemented directly in this session (no subagent), 17 Nov 2026. Body limit for the decision POST is 16 KB, not `LIMITS.body.admin` (4 KB), so 2,000 Arabic characters fit.
- Checked live through ngrok: counts for Almaty match the jsonl (4 answers); approve then reject saved and survived a reload; `.data/index.json` unchanged (13 Nov). Test decisions were deleted afterwards.
- The daily backup task (outside the repo) now also copies `guide-check-decisions.jsonl`.

## Spec Change Log

- **23 Nov 2026 (Bushra):** new answers re-open a decided item. An answer saved after the item's latest decision that disagrees with the guide (wrong, closed, easier, harder) counts in `newCounts`. Such items show under "Needs decision" with a "New since the decision" line until a new decision is saved. Confirming marks (correct, right, unknown) don't re-open. Reason: the 21 Nov Almaty answer was hidden because its items were already approved.

## Review Triage Log

Self-review of the diff (no reviewer subagents in this session), 17 Nov 2026.

- **low · patch:** a saved answer whose things/buy/ease field is not a list would crash the summary. It is now treated as empty.
- **medium · patch (outside the repo):** the daily backup copied only the answers, not the decisions. It now copies both.
- **low · rejected:** two notes with the same millisecond timestamp in one city would share a key. Answers are saved one at a time with ms timestamps, so this is unlikely in normal use.
- **deferred:** tracking which approved items have been published (see Design Notes).

## Design Notes

"Waiting to publish" is how Bushra hands over to the publish step: she (or Claude) reads the approved items and their texts, edits `website/data/`, runs ingest and eval. Tracking which approved items have been published is deferred.

## Verification

**Commands:**
- `npm test` -- expected: all pass, including the new review tests.
- `npx tsc --noEmit` and `npm run lint` -- expected: no errors.

**Manual checks:**
- Log in at /admin/guide through ngrok and check the Almaty counts against the jsonl. Approve one item, reload, then reject it. Confirm the decisions file and the unchanged index timestamp.
