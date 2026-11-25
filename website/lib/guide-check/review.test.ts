import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ADMIN_COOKIE, adminToken } from "../ratings/admin-auth";
import { ANSWERS_FILE, DECISIONS_FILE, appendDecision, itemKey, knownKeys, loadReview, noteKey, summarizeAnswers, type AnswerRow } from "./review";

const row = (at: string, mark: string, extra: Partial<AnswerRow> = {}): AnswerRow => ({
  at, city: "Almaty", country: "Kazakhstan", lang: "en", visit: "2025-10",
  things: [{ item: "Kok-Tobe hill", mark }], buy: [], ease: [], halal: "easy", feel: "enjoyable", ...extra,
});

test("no answers: empty review", () => {
  assert.deepEqual(summarizeAnswers([], []), []);
});

test("grouped counts per item, halal and feel", () => {
  const rows = [row("1", "correct"), row("2", "correct"), row("3", "correct"), row("4", "closed", { halal: "hard" })];
  const [c] = summarizeAnswers(rows, []);
  assert.equal(c.answers, 4);
  assert.equal(c.items.length, 1);
  assert.deepEqual(c.items[0].counts, { correct: 3, closed: 1 });
  assert.equal(c.items[0].key, itemKey("Almaty", "thing", "Kok-Tobe hill"));
  assert.deepEqual(c.halal, { easy: 3, hard: 1 });
  assert.deepEqual(c.feel, { enjoyable: 4 });
});

test("free text becomes a note with its own key", () => {
  const [c] = summarizeAnswers([row("2026-11-16T10:00:00Z", "correct", { thingsMissing: "Add Charyn Canyon" })], []);
  assert.equal(c.notes.length, 1);
  assert.equal(c.notes[0].text, "Add Charyn Canyon");
  assert.equal(c.notes[0].part, "thingsMissing");
  assert.equal(c.notes[0].key, noteKey("Almaty", "2026-11-16T10:00:00Z", "thingsMissing"));
  assert.ok(knownKeys([c]).has(c.notes[0].key));
});

test("latest decision wins (approve, then reject)", () => {
  const key = itemKey("Almaty", "thing", "Kok-Tobe hill");
  const [a] = summarizeAnswers([row("1", "correct")], [{ at: "t1", key, decision: "approved", text: "Keep it" }]);
  assert.equal(a.items[0].decision?.decision, "approved");
  const [b] = summarizeAnswers([row("1", "correct")], [
    { at: "t1", key, decision: "approved", text: "Keep it" },
    { at: "t2", key, decision: "rejected", text: null },
  ]);
  assert.equal(b.items[0].decision?.decision, "rejected");
});

test("new disagreeing answers after a decision are counted, so the item needs a fresh look", () => {
  const key = itemKey("Almaty", "thing", "Kok-Tobe hill");
  const rows = [row("2026-11-16T10:00:00Z", "correct"), row("2026-11-21T05:00:00Z", "closed")];
  const [a] = summarizeAnswers(rows, [{ at: "2026-11-20T12:00:00Z", key, decision: "approved", text: null }]);
  assert.deepEqual(a.items[0].counts, { correct: 1, closed: 1 });
  assert.deepEqual(a.items[0].newCounts, { closed: 1 });
  const [b] = summarizeAnswers(rows, [{ at: "2026-11-22T09:00:00Z", key, decision: "approved", text: null }]);
  assert.deepEqual(b.items[0].newCounts, {});
  const [c] = summarizeAnswers(rows, []);
  assert.deepEqual(c.items[0].newCounts, {});
  const [d] = summarizeAnswers([...rows, row("2026-11-21T06:00:00Z", "correct")], [{ at: "2026-11-20T12:00:00Z", key, decision: "approved", text: null }]);
  assert.deepEqual(d.items[0].newCounts, { closed: 1 }, "a new 'correct' only confirms, so it is not counted");
});

test("files: missing file is empty, broken lines are skipped, decisions are appended", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gc-review-"));
  try {
    assert.deepEqual(await loadReview(dir), []);
    await writeFile(path.join(dir, ANSWERS_FILE), JSON.stringify(row("1", "correct")) + "\n{broken\n" + JSON.stringify(row("2", "wrong")) + "\n");
    const [c] = await loadReview(dir);
    assert.equal(c.answers, 2);
    await appendDecision({ at: "t1", key: c.items[0].key, decision: "approved", text: null }, dir);
    await appendDecision({ at: "t2", key: c.items[0].key, decision: "rejected", text: "No" }, dir);
    assert.equal((await readFile(path.join(dir, DECISIONS_FILE), "utf8")).trim().split("\n").length, 2);
    assert.equal((await loadReview(dir))[0].items[0].decision?.text, "No");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("admin guide-check route: 503 off, 401 without cookie, 400 for bad input (nothing written)", async () => {
  const route = await import("../../app/api/admin/guide-check/route");
  const PW = "route-test-password-123";
  const post = (body: unknown, cookie?: string) =>
    new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  process.env.ADMIN_PASSWORD = "";
  assert.equal((await route.GET(new Request("http://x"))).status, 503);
  process.env.ADMIN_PASSWORD = PW;
  assert.equal((await route.GET(new Request("http://x"))).status, 401);
  assert.equal((await route.POST(post({ key: "x", decision: "approved" }))).status, 401);
  const cookie = `${ADMIN_COOKIE}=${adminToken(PW)}`;
  assert.equal((await route.POST(post({ key: "x", decision: "maybe" }, cookie))).status, 400);
  assert.equal((await route.POST(post({ key: "x", decision: "approved", text: 5 }, cookie))).status, 400);
  assert.equal((await route.POST(post({ key: "x", decision: "approved", text: "a".repeat(2001) }, cookie))).status, 400);
  assert.equal((await route.POST(post({ key: "Nowhere|thing|nothing", decision: "approved" }, cookie))).status, 400);
  process.env.ADMIN_PASSWORD = "";
});

test("save route: a reason is kept only for Wrong / Not open / Easier / Harder, cut to 1,000 characters", async () => {
  const { cityGuides } = await import("./content");
  const g = cityGuides().find((c) => c.city === "Almaty")!; // loads (and caches) the guide before leaving the website folder
  const route = await import("../../app/api/guide-check/route");
  const home = process.cwd();
  const dir = await mkdtemp(path.join(os.tmpdir(), "gc-why-"));
  try {
    process.chdir(dir);
    const body = {
      city: "Almaty", visitMonth: 8, visitYear: 2025, lang: "en",
      things: ["wrong", "correct", "closed"], thingsWhy: ["Closed for repairs", "ignored", "x".repeat(5000)],
      ease: ["harder"], easeWhy: ["  Steep path  "],
    };
    const res = await route.POST(new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify(body) }));
    assert.equal(res.status, 200);
    const row = JSON.parse((await readFile(path.join(dir, ".data", ANSWERS_FILE), "utf8")).trim()) as AnswerRow;
    assert.deepEqual(row.things?.[0], { item: g.things[0], mark: "wrong", why: "Closed for repairs" });
    assert.deepEqual(row.things?.[1], { item: g.things[1], mark: "correct" }, "no reason for an agreeing mark");
    assert.equal(row.things?.[2].why?.length, 1000);
    assert.equal(row.ease?.[0].why, "Steep path");
    const [c] = summarizeAnswers([row], []);
    assert.deepEqual(c.items[0].reasons, [{ mark: "wrong", text: "Closed for repairs", at: row.at }]);
    assert.deepEqual(c.items[1].reasons, []);
  } finally {
    process.chdir(home);
    await rm(dir, { recursive: true, force: true });
  }
});

test("overview question: only a plain 'about <city>' question", async () => {
  const { isOverviewQuestion } = await import("./overview");
  for (const q of ["Tell me about Dubai, UAE", "tell me about dubai", "Dubai?", "What about Dubai", "Can you tell me more about Dubai please", "Cappadocia"])
    assert.equal(isOverviewQuestion(q, q.includes("Cappadocia") ? "Cappadocia (Göreme)" : "Dubai", q.includes("Cappadocia") ? "Türkiye" : "UAE"), true, q);
  for (const q of ["What should I buy in Dubai?", "Is Dubai safe?", "Halal food in Dubai", "Tell me about Abu Dhabi"])
    assert.equal(isOverviewQuestion(q, "Dubai", "UAE"), false, q);
});
