---
title: 'Chat: "View all 81 cities" list on the left'
type: 'feature'
created: '2026-11-24'
status: 'done'
route: 'dispatch'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users can't see which cities Ummah One covers.

**Approach (Bushra, 24 Nov 2026):** A "View all 81 cities" button on the left of the chat. Clicking it opens the city list on the left, and the questions and answers shift slightly to the right.
- Clicking a city asks the chatbot about it, e.g. "Tell me about Almaty, Kazakhstan" (answer 1).
- Cities are grouped by country (answer 1).
- On phones, the list opens above the chat and pushes it down (answer 2).

## Boundaries & Constraints

**Always:** the list comes from the guide data (`ALL-81-CITIES.md` via `cityGuides()`), so the count is never typed by hand; English and Arabic labels; works in RTL (list on the start side).
**Never:** change the answers, search or chatbot data.

## Behaviour

| Screen | Closed | Open | Click a city |
|---|---|---|---|
| Wide (1000px+) | Button fixed at the top left | List panel on the left; chat column shifts right | Question sent; list stays open |
| Phone / narrow | Button at the top of the chat | List opens in the page, chat pushed down | Question sent; list closes |

</frozen-after-approval>

## Code Map

- `website/app/page.tsx` -- loads cities grouped by country and passes them to `Chat`.
- `website/components/Chat.tsx` -- button, list, `cities-open` class.
- `website/lib/i18n.ts` -- labels and the city question (en, ar).
- `website/app/globals.css` -- `.cities*` styles and the shift.

## Verification

- `npm test`, `npx tsc --noEmit`, `npm run lint`.
- Screenshots at 1400px and 412px, closed and open.
