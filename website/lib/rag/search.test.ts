import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "./ingest";
import { JsonStore } from "./store";
import { search, IndexMissing } from "./search";
import type { Embedder } from "./embed";

// Fake meaning model: a vector of topic word counts, so "sea" questions match "beach/sea" text.
const TOPICS = [["sea", "beach", "coast", "بحر"], ["study", "university"], ["silk", "madrasa", "caravan"], ["ski", "snow"]];
const fake = (model = "fake"): Embedder => ({
  model,
  embed: async (texts) => texts.map((t) => [...TOPICS.map((ws) => ws.filter((w) => t.toLowerCase().includes(w)).length), 0.01]),
});
const down: Embedder = { model: "fake", embed: async () => { throw new Error("connect ECONNREFUSED"); } };

const TRAVEL = `# Türkiye
## Bodrum, Türkiye
Calm: Tranquility & Peace 7/10 · Healing 6/10
A calm coast town with a long beach and the sea all around.
## Konya, Türkiye
Calm: Tranquility & Peace 8/10 · Healing 8/10
An inland city of Rumi, far from any coast.
# Balkans
## Ohrid, North Macedonia
Calm: Tranquility & Peace 9/10 · Healing 9/10
A lake town, very calm.
## Tirana, Albania
Calm: Tranquility & Peace 4/10 · Healing 4/10
A busy capital.
# Middle East and Gulf — x
## Dubai, UAE
Calm: Tranquility & Peace 3/10 · Healing 3/10
A modern city by the sea. Ski Dubai is inside a mall.
# Central Asia
## Samarkand, Uzbekistan
Calm: Tranquility & Peace 6/10 · Healing 6/10
A silk road city of madrasas and caravan history.
## Cairo, Egypt
Calm: Tranquility & Peace 2/10 · Healing 2/10
A huge historic city on the Nile.
# Southeast and South Asia
## Malé, Maldives
Calm: Tranquility & Peace 5/10 · Healing 5/10
A small island capital.
# Russia
## Kazan, Russia
Calm: Tranquility & Peace 6/10 · Healing 6/10
The Tatar capital on the Volga.`;

const EDU = `# Education cities — sample
## Cairo, Egypt
Study in Cairo: Cairo University, Ain Shams University.
## Dubai, UAE
Study in Dubai: MBRU, Dubai Medical College.`;

async function setup() {
  const root = mkdtempSync(join(tmpdir(), "search-"));
  const data = join(root, "data");
  mkdirSync(join(data, "travel"), { recursive: true });
  mkdirSync(join(data, "education"), { recursive: true });
  writeFileSync(join(data, "travel", "guides.md"), TRAVEL);
  writeFileSync(join(data, "education", "edu.md"), EDU);
  writeFileSync(join(data, "education", "edu.meta.json"), '{ "regionFromHeading": false }');
  const store = new JsonStore(join(root, ".data", "index.json"));
  await ingest({ dataDir: data, store, embedder: fake() });
  return store;
}

test("country filter: only Türkiye chunks (also for 'Turkey')", async () => {
  const store = await setup();
  for (const q of ["somewhere peaceful by the sea in Türkiye", "quiet beach town in Turkey"]) {
    const r = await search(q, { store, embedder: fake() });
    assert.ok(r.chunks.length > 0);
    assert.ok(r.chunks.every((c) => !c.meta.country || c.meta.country === "Türkiye" || c.meta.region === "Türkiye"), q);
    assert.equal(r.chunks[0].meta.city, "Bodrum", q);
  }
});

test("Arabic question finds the same city", async () => {
  const store = await setup();
  const r = await search("أريد السفر إلى دبي", { store, embedder: fake() });
  assert.equal(r.chunks.find((c) => c.meta.city)?.meta.city, "Dubai");
  assert.ok(r.chunks.filter((c) => c.meta.city).every((c) => c.meta.city === "Dubai"));
});

test("category: 'study in Cairo' puts the education chunk first", async () => {
  const store = await setup();
  const r = await search("study in Cairo", { store, embedder: fake() });
  assert.equal(r.chunks[0].category, "education");
  assert.equal(r.chunks[0].meta.city, "Cairo");
});

test("comparison: Balkans ratings table is returned", async () => {
  const store = await setup();
  const r = await search("Which is the calmest city in the Balkans?", { store, embedder: fake() });
  assert.ok(r.chunks.some((c) => c.title === "Balkans: city ratings" && /Ohrid, North Macedonia: Tranquility & Peace 9\/10/.test(c.text)));
});

test("no place: meaning search finds the silk road city", async () => {
  const store = await setup();
  const r = await search("old silk road cities", { store, embedder: fake() });
  assert.equal(r.places.length, 0);
  assert.equal(r.chunks[0].meta.city, "Samarkand");
});

test("blocked place: no chunks at all", async () => {
  const store = await setup();
  const r = await search("Tell me about Grozny", { store, embedder: fake() });
  assert.deepEqual(r.chunks, []);
});

test("no index: IndexMissing", async () => {
  const store = new JsonStore(join(mkdtempSync(join(tmpdir(), "none-")), "index.json"));
  await assert.rejects(search("Dubai", { store, embedder: fake() }), IndexMissing);
});

test("embed down: keyword search still answers", async () => {
  const store = await setup();
  const r = await search("Tell me about Konya", { store, embedder: down });
  assert.equal(r.usedVectors, false);
  assert.equal(r.chunks[0].meta.city, "Konya");
});

test("'male' is not read as the city Malé", async () => {
  const store = await setup();
  const r = await search("is Dubai good for male travellers?", { store, embedder: fake() });
  assert.deepEqual(r.places.map((p) => p.value), ["Dubai"]);
  const m = await search("things to do in Malé", { store, embedder: fake() });
  assert.deepEqual(m.places.map((p) => p.value), ["Malé"]);
});

test("'kazan' the cooking pot is not the city, but 'in Kazan' is", async () => {
  const store = await setup();
  const pot = await search("where can I watch plov cooked in a giant kazan?", { store, embedder: fake() });
  assert.equal(pot.places.length, 0);
  for (const q of ["Typical dishes in Kazan", "Kazan halal food", "I want to visit Kazan"]) {
    const r = await search(q, { store, embedder: fake() });
    assert.deepEqual(r.places.map((p) => p.value), ["Kazan"], q);
  }
});
