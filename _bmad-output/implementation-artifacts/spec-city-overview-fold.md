---
title: 'City reply with folded headings; Dubai update; country order; Bali and North Macedonia removed'
type: 'feature'
created: '2026-11-25'
status: 'done'
route: 'dispatch'
context: ['spec-chat-city-list.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent (Bushra, 25 Nov 2026)

- A city reply ("Tell me about Dubai") shows closed headings: **Places to visit, Food, Shopping, Vibe**. Clicking a heading opens what we added. Same format for all cities (answer 2). The Halal food and prayer heading is not used.
- The ratings heading is **Vibe**.
- Dubai: the 28 places replace the old "20 Things to Do" (answer 1). New Food list of 15 cuisines, with tiramisu and mapo tofu removed (halal, answer 1). Vibe: Tranquility 5, Healing 6, Traditional 9, Historic 8, Cultural 8, Modern 10; Busy & Loud and Too Much Tourism stay 9.
- City list follows Bushra's country order. Algeria keeps its first place (16) and shows once its data is added.
- North Macedonia (Ohrid, Skopje, Tetovo) and Bali are removed from everything (answer 1). Jakarta and Algeria will be added when Bushra sends the data.

## Boundaries

**Always:** the folded reply is built in code from the data (no model), so it shows only what we added. Sections without data are left out (Food exists for Dubai only so far).
**Never:** invent data for Jakarta or Algeria.

</frozen-after-approval>

## Design Notes

- The folded reply is used only for a plain "about <city>" question in English with no image and no longer/shorter request. Arabic replies and specific questions still go to the model.
- Saved survey answers for the removed cities stay in `.data` but no longer match a guide city.

## Verification

- Tests 105/105; eval 98/99 (pass). Miss: "Where can I ski indoors?" — the new Dubai text says "Mall of the Emirates … home to Ski Dubai", which search no longer links to indoor skiing.
- Screenshots: Dubai reply with closed headings; Food opened; country order in the list.
