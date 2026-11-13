import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateRating, ratableCity, travelCities } from "./cities";
import { FileRatingStore, SupabaseRatingStore, cleanLabels, summarize, type Rating } from "./store";
import { buildContext, isLabel, labelsForPrompt, LABEL_RULE, MAX_COMMENT } from "./labels";
import { adminToken, checkCookie, checkPassword, deny, ADMIN_COOKIE, SESSION_MS } from "./admin-auth";
import { detectPlaces, loadIndex } from "../rag/search";
import { DEFAULT_INDEX_PATH } from "../rag/store";

const CITIES = ["Konya", "Bodrum", "Fethiye", "Kuwait City"];
const ok = { deviceId: "abc123def456", city: "Konya", label: "enjoyable", visited: true };

test("rate: a visitor rating is accepted", () => {
  assert.deepEqual(validateRating({ ...ok, comment: "  Lovely  " }, CITIES), { deviceId: "abc123def456", city: "Konya", label: "enjoyable", comment: "Lovely" });
});

test("not visited: rejected", () => {
  assert.ok("error" in validateRating({ ...ok, visited: false }, CITIES));
  assert.ok("error" in validateRating({ ...ok, visited: "true" }, CITIES));
  assert.ok("error" in validateRating({ ...ok, visited: undefined }, CITIES));
});

test("unknown or blocked city: rejected", () => {
  assert.ok("error" in validateRating({ ...ok, city: "Paris" }, CITIES));
  assert.ok("error" in validateRating({ ...ok, city: "Lahore" }, [...CITIES, "Lahore"]));
});

test("bad label rejected; long comment cut to 500", () => {
  assert.ok("error" in validateRating({ ...ok, label: "great" }, CITIES));
  assert.equal(isLabel("most_enjoyable"), true);
  const v = validateRating({ ...ok, comment: "x".repeat(900) }, CITIES);
  assert.ok(!("error" in v) && v.comment!.length === MAX_COMMENT);
  assert.ok("error" in validateRating({ ...ok, deviceId: "x" }, CITIES));
});

test("same device again: the new rating replaces the old one; labels set and clear", async () => {
  const store = new FileRatingStore(mkdtempSync(join(tmpdir(), "ratings-")));
  const r = (label: Rating["label"], device = "dev1"): Rating => ({ device_id: device, city: "Konya", label, visited: true, comment: null, created_at: new Date().toISOString() });
  await store.addRating(r("boring"));
  await store.addRating(r("most_enjoyable"));
  await store.addRating(r("enjoyable", "dev2"));
  const all = await store.listRatings();
  assert.equal(all.length, 2);
  assert.equal(all.find((x) => x.device_id === "dev1")!.label, "most_enjoyable");
  const [konya, bodrum] = summarize(all, ["Konya", "Bodrum"]);
  assert.equal(konya.total, 2);
  assert.equal(konya.counts.most_enjoyable, 1);
  assert.equal(bodrum.total, 0);

  assert.deepEqual(await store.getLabels(), {});
  await store.setLabel("Konya", "most_enjoyable");
  assert.deepEqual(await store.getLabels(), { Konya: "most_enjoyable" });
  await store.setLabel("Konya", null);
  assert.deepEqual(await store.getLabels(), {});
});

test("admin: no password set → 503; wrong password → 401; right cookie → ok", () => {
  assert.equal(checkPassword("anything", ""), "disabled");
  assert.equal(deny("disabled").status, 503);
  assert.equal(checkPassword("wrong", "s3cret-long-pass"), "denied");
  assert.equal(deny("denied").status, 401);
  assert.equal(checkPassword("s3cret-long-pass", "s3cret-long-pass"), "ok");
  assert.equal(checkCookie(`${ADMIN_COOKIE}=${adminToken("s3cret-long-pass")}`, "s3cret-long-pass"), "ok");
  assert.equal(checkCookie(`${ADMIN_COOKIE}=${adminToken("other")}`, "s3cret-long-pass"), "denied");
  assert.equal(checkCookie(null, "s3cret-long-pass"), "denied");
  assert.equal(checkCookie(`${ADMIN_COOKIE}=${adminToken("x")}`, ""), "disabled");
});

test("chat: box only for exactly one travel city", () => {
  assert.equal(ratableCity([{ kind: "city", value: "Konya" }], CITIES), "Konya");
  assert.equal(ratableCity([{ kind: "city", value: "Bodrum" }, { kind: "city", value: "Fethiye" }], CITIES), null);
  assert.equal(ratableCity([], CITIES), null);
  assert.equal(ratableCity([{ kind: "country", value: "Türkiye" }], CITIES), null);
  assert.equal(ratableCity([{ kind: "city", value: "Paris" }], CITIES), null);
});

test("chat: unrated cities are not labelled; approved labels are given to the model", () => {
  const none = labelsForPrompt({});
  assert.match(none, /has not rated any city yet/);
  const one = labelsForPrompt({ Konya: "most_enjoyable" });
  assert.match(one, /- Konya: Most enjoyable/);
  assert.doesNotMatch(one, /No city has/);
  assert.match(labelsForPrompt({ Konya: "most_enjoyable" }, "Bodrum"), /Bodrum: NOT rated yet/);
  assert.match(labelsForPrompt({ Konya: "most_enjoyable" }, "Konya"), /Konya: rated Most enjoyable/);
  assert.match(LABEL_RULE, /never call a place boring or enjoyable on your own/);
});

const hasIndex = existsSync(DEFAULT_INDEX_PATH);

test("real index: 81 travel cities; question detection", { skip: !hasIndex && "run npm run ingest first" }, () => {
  const cities = travelCities();
  assert.equal(cities.length, 81);
  const names = loadIndex().names;
  assert.equal(ratableCity(detectPlaces("Tell me about Konya", names), cities), "Konya");
  assert.equal(ratableCity(detectPlaces("Compare Bodrum and Fethiye", names), cities), null);
  assert.equal(ratableCity(detectPlaces("Which places are most enjoyable?", names), cities), null);
  assert.equal(ratableCity(detectPlaces("Tell me about Stone Town", names), cities), "Zanzibar City (Stone Town)");
});

test("bad bodies and comment edge cases", () => {
  assert.ok("error" in validateRating(null, CITIES));
  assert.ok("error" in validateRating(5 as never, CITIES));
  const emoji = validateRating({ ...ok, comment: "😀".repeat(600) }, CITIES);
  assert.ok(!("error" in emoji) && Array.from(emoji.comment!).length === MAX_COMMENT && !/[\uD800-\uDBFF]$/.test(emoji.comment!));
  const nul = validateRating({ ...ok, comment: "a\u0000b" }, CITIES);
  assert.ok(!("error" in nul) && nul.comment === "ab");
});

test("admin: short password disables admin; session expires after 12 hours", () => {
  assert.equal(checkPassword("short", "short"), "disabled");
  const pw = "a-long-admin-password";
  const now = Date.now();
  assert.equal(checkCookie(`${ADMIN_COOKIE}=${adminToken(pw, now - SESSION_MS - 1)}`, pw, now), "denied");
  assert.equal(checkCookie(`${ADMIN_COOKIE}=${adminToken(pw, now + 60_000)}`, pw, now), "denied");
  assert.equal(checkCookie(`${ADMIN_COOKIE}=${adminToken(pw, now - 1000)}`, pw, now), "ok");
  assert.equal(checkCookie(`${ADMIN_COOKIE}=${adminToken(pw, now)}xx`, pw, now), "ok"); // regex takes the 64 hex chars; tampered digits fail below
  const tok = adminToken(pw, now);
  const bad = tok.slice(0, -1) + (tok.endsWith("0") ? "1" : "0");
  assert.equal(checkCookie(`${ADMIN_COOKIE}=${bad}`, pw, now), "denied");
});

test("file store: a corrupt file throws instead of being overwritten; bad labels are dropped", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ratings-bad-"));
  writeFileSync(join(dir, "place-ratings.json"), "[{ broken");
  const store = new FileRatingStore(dir);
  await assert.rejects(() => store.listRatings());
  await assert.rejects(() => store.addRating({ device_id: "d", city: "Konya", label: "boring", visited: true, comment: null, created_at: "2026-11-13T00:00:00Z" }));
  assert.deepEqual(cleanLabels({ Konya: "boring", Bodrum: "great", X: null }), { Konya: "boring" });
  assert.deepEqual(cleanLabels(null), {});
  assert.deepEqual(cleanLabels(["boring"]), {});
});

test("supabase store: upsert, label set/clear and paging use the right requests", async () => {
  const calls: { url: string; method: string; prefer?: string; body?: string }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const h = init.headers as Record<string, string>;
    calls.push({ url, method: init.method ?? "GET", prefer: h.Prefer, body: init.body as string | undefined });
    if (url.includes("place_labels?select")) return new Response(JSON.stringify([{ city: "Konya", label: "enjoyable" }, { city: "Bad", label: "x" }]));
    if (url.includes("place_ratings?select")) {
      const offset = Number(new URL(url).searchParams.get("offset"));
      const n = offset === 0 ? 1000 : 5;
      return new Response(JSON.stringify(Array.from({ length: n }, (_, i) => ({ device_id: `d${offset + i}`, city: "Konya", label: "boring", visited: true, comment: null, created_at: "2026-11-13T00:00:00Z" }))));
    }
    return new Response(null, { status: 201 });
  }) as typeof fetch;
  try {
    const s = new SupabaseRatingStore("https://x.supabase.co", "key");
    await s.addRating({ device_id: "d1", city: "Konya", label: "boring", visited: true, comment: null, created_at: "t" });
    assert.match(calls[0].url, /place_ratings\?on_conflict=device_id,city$/);
    assert.equal(calls[0].method, "POST");
    assert.match(calls[0].prefer!, /resolution=merge-duplicates/);
    await s.setLabel("Cappadocia (Göreme)", "enjoyable");
    assert.match(calls[1].url, /place_labels\?on_conflict=city$/);
    assert.equal(JSON.parse(calls[1].body!).label, "enjoyable");
    await s.setLabel("Cappadocia (Göreme)", null);
    assert.equal(calls[2].method, "DELETE");
    assert.ok(calls[2].url.endsWith(`city=eq.${encodeURIComponent("Cappadocia (Göreme)")}`));
    assert.deepEqual(await s.getLabels(), { Konya: "enjoyable" });
    assert.equal((await s.listRatings()).length, 1005);
  } finally {
    globalThis.fetch = real;
  }
});

test("chat context: labels entry first, with the asked city's status", () => {
  const c = buildContext({ labels: { Konya: "most_enjoyable" }, city: "Bodrum", passages: ["[1] (travel) Bodrum\ntext"], labelsAvailable: true });
  assert.ok(c.startsWith("[0] Ummah One enjoyment labels"));
  assert.match(c, /Bodrum: NOT rated yet/);
  assert.ok(c.indexOf("[0]") < c.indexOf("[1]"));
  assert.match(buildContext({ labels: {}, city: null, passages: [], labelsAvailable: true }), /no matching information/);
  const down = buildContext({ labels: {}, city: "Konya", passages: [], labelsAvailable: false });
  assert.match(down, /could not be loaded/);
  assert.doesNotMatch(down, /has not rated any city/);
});
