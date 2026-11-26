---
title: 'Food for every city from the Expanded Halal Food Companion'
type: 'feature'
created: '2026-11-26'
status: 'done'
route: 'dispatch'
context: []
---

## Intent

**Problem:** Only Dubai had a Food list, so the Food heading in city replies showed only for Dubai.

**Approach (Bushra, 26 Nov 2026):** "Use this" PDF (`sources/Ummah_One_Expanded_Halal_Food_Companion.pdf`) as the food data for all places.

## Boundaries & Constraints

**Always:** halal only. Horse meat, kymyz, black risotto and buzara stay out (policy of 11 Nov). Venues the PDF flags for alcohol or fermentation are left out. Warnings stay.
**Never:** change Dubai's 15 cuisines without asking; add Bali (removed) or Algeria cities (no city data yet).

## Data format

```
### Food in <city>

1.–5. Dish — description
6. Also try: …

**Where to eat:** Venue (dishes); … Check the dish, opening times and halal status before you go.

**Tip:** …
```

## Code Map

- `website/data/travel/ALL-81-CITIES.md` — 76 new food sections.
- `website/lib/guide-check/content.ts` — `foodNotes` (Where to eat / Tip lines).
- `website/lib/guide-check/overview.ts` — Food heading shows the notes under the list.
- `website/lib/ratings/routes.test.ts` — Astana overview test.

## Verification

- `npm run ingest`, `npm test` 105/105, `npx tsc --noEmit`, `npm run lint`, `npm run eval` 98/99.
