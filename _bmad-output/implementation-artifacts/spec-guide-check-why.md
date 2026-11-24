---
title: 'Guide check: "Tell us why" box for Wrong / Not open / Easier / Harder'
type: 'feature'
created: '2026-11-23'
status: 'done'
route: 'dispatch'
context: ['spec-guide-check-review.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** On /check, testers can mark an item Wrong, Not open, Easier or Harder, but cannot say why. By 23 Nov there were 149 such marks with no reason, so Mr Tanveer cannot tell what to change.

**Approach (Bushra, 23 Nov 2026: "yes"):**
1. When a tester picks Wrong, Not open, Easier or Harder, a small optional box "Tell us why" opens under that item.
2. The end-of-section boxes say "Anything to add or correct here? (optional)" instead of "What's missing?".
3. The admin review page shows each reason under its item.

## Boundaries & Constraints

**Always:** optional box; anonymous; English and Arabic; reason max 1,000 characters; old answers keep working.
**Never:** write to `website/data/` or the index; change saved answers; make any box required.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected |
|---|---|---|
| Reason with a disagreeing mark | things[2]="wrong", thingsWhy[2]="Closed since 2024" | Saved as `{item, mark:"wrong", why:"Closed since 2024"}` |
| Reason with "Correct" | mark "correct" + text | Reason dropped (box is hidden for agreeing marks) |
| Mark changed back to Correct | tester types a reason, then picks Correct | Box hides; reason not sent |
| Old answers | no `why` | Review page works as before |
| Too long | 5,000 chars | Cut to 1,000 |

</frozen-after-approval>

## Code Map

- `website/components/GuideCheck.tsx` -- form; add per-item reason box.
- `website/lib/guide-check/strings.ts` -- labels (en, ar).
- `website/app/api/guide-check/route.ts` -- save `why` per item.
- `website/lib/guide-check/review.ts` -- collect reasons per item.
- `website/app/admin/guide/page.tsx` -- show reasons.
- `website/app/globals.css` -- small styles.

## Verification

- `npm test`, `npx tsc --noEmit`, `npm run lint`.
- Screenshot /check with a "Wrong" mark (box shows), and /admin/guide.
