import { test } from "node:test";
import assert from "node:assert/strict";
import { haramReason, removeHaramItems } from "./haram";

test("dishes and drinks with pork or alcohol are caught", () => {
  for (const [item, why] of [
    ["3. Buzara mussels — shellfish in garlic, wine-free tomato broth on request.", "buzara"],
    ["4. Ayam betutu (choose chicken, not duck or pork, versions).", "pork"],
    ["2. Pasta with pancetta", "pancetta"],
    ["- Local rakija tasting", "rakija"],
    ["5. Tiramisu to finish", "tiramisu"],
    ["7. Sip cocktails at sunset", "cocktails"],
  ])
    assert.equal(haramReason(item), why, item);
});

test("alcohol venues you are sent to are caught; passing by is fine", () => {
  assert.equal(haramReason("15. Spend an evening at a rooftop lounge, beach club, or shisha café."), "rooftop lounge");
  assert.equal(haramReason("9. Have dinner at a konoba on the bay."), "konoba");
  assert.equal(haramReason("3. Visit a pub in the old town."), "pub");
  assert.equal(haramReason("6. Stroll the Corniche, lined with beach clubs, cafés, and restaurants."), null);
  assert.equal(haramReason("10. Relax on the beaches of the South Coast and the Berenice Beach Club."), "beach club");
  assert.equal(haramReason("17. Suhareka vineyards: 7/10."), "vineyards");
});

test("false alarms are not removed", () => {
  for (const ok of [
    "14. Take a 4x4 jeep tour through the red sands of Wadi Rum.",
    "1. Visit the tomb of Rumi.",
    "17. Explore the ruins of Stari Bar, an abandoned hilltop town.",
    "14. Walk on water along the sand bar near Orhaniye.",
    "20. Cool off with fresh mango juice from a local juice bar.",
    "4. Harira — tomato-lentil soup that breaks the fast.",
    "2. Hamour fish with rice.", // "ham" inside a word
  ])
    assert.equal(haramReason(ok), null, ok);
});

test("removes whole wrapped items and keeps warnings in prose", () => {
  const text = [
    "Not every stall is halal, since some dishes use pork, so look for halal signs.",
    "1. Nasi kandar — rice with curries.",
    "2. Buzara mussels — shellfish in garlic,",
    "tomato broth.",
    "3. Cendol — shaved ice with palm sugar.",
  ].join("\n");
  const r = removeHaramItems(text);
  assert.equal(r.text, [
    "Not every stall is halal, since some dishes use pork, so look for halal signs.",
    "1. Nasi kandar — rice with curries.",
    "3. Cendol — shaved ice with palm sugar.",
  ].join("\n"));
  assert.equal(r.removed.length, 1);
  assert.match(r.removed[0], /^2\. Buzara mussels — shellfish in garlic, tomato broth\. \(buzara\)$/);
});

test("a paragraph sentence naming a haram dish is removed; the rest stays", () => {
  const r = removeHaramItems("Kotor is cheap. Food here is Mediterranean: grilled fish, black cuttlefish risotto, mussels in buzara sauce. Halal restaurants are rare.");
  assert.equal(r.text, "Kotor is cheap. Halal restaurants are rare.");
  assert.equal(r.removed.length, 1);
});

test("policy: horse meat and kymyz removed; riding a horse and seafood kept", () => {
  assert.equal(haramReason("2. Kazy — horse-meat sausage, the festive delicacy."), "kazy");
  assert.equal(haramReason("6. Try shubat, fermented camel milk."), "shubat");
  assert.equal(haramReason("5. Kymyz — fermented mare's milk, the ancient steppe drink."), "kymyz");
  assert.equal(haramReason("2. Explore the Green Bazaar for horse meat, dried fruit, honey."), "horse meat");
  assert.equal(haramReason("14. Ride a camel or horse through the desert canyons."), null);
  assert.equal(haramReason("10. Stand beneath the giant Warrior on a Horse statue."), null);
  assert.equal(haramReason("5. Grilled Red Sea shrimp — straight from the fish market."), null);
  const r = removeHaramItems("Food is hearty. Try beshbarmak, kazy horse sausage, and baursak. Lagman is everywhere.");
  assert.equal(r.text, "Food is hearty. Lagman is everywhere.");
});
