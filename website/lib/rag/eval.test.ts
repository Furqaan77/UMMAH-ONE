import { test } from "node:test";
import assert from "node:assert/strict";
import { runEval, type EvalCase } from "./eval";
import { findBlocked } from "./blocked";
import type { Chunk } from "./types";

const chunk = (title: string, section = title): Chunk => ({ id: title, category: "travel", file: "f.md", title, section, text: "", meta: {}, source: "", hash: "" });

test("scores hits by title or section substring", async () => {
  const cases: EvalCase[] = [
    { q: "a", group: "g1", expect: ["Dubai"] },
    { q: "b", group: "g1", expect: ["Things to Do"] },
    { q: "c", group: "g2", expect: ["Doha"] },
  ];
  const r = await runEval(cases, async (q) => (q === "c" ? [chunk("Cairo, Egypt")] : [chunk("Dubai, UAE", "20 Things to Do in Dubai")]));
  assert.equal(r.passed, 2);
  assert.equal(r.score, 66.7);
  assert.equal(r.ok, false);
  assert.deepEqual(r.groups, { g1: { total: 2, passed: 2 }, g2: { total: 1, passed: 0 } });
  assert.equal(r.failures[0].q, "c");
});

test("blocked question with any result fails the run, even at 100% elsewhere", async () => {
  const cases: EvalCase[] = [...Array(19)].map((_, i) => ({ q: `q${i}`, group: "g", expect: ["X"] }));
  cases.push({ q: "Grozny", group: "blocked", none: true });
  const r = await runEval(cases, async () => [chunk("X")]);
  assert.equal(r.score, 95);
  assert.equal(r.blockedLeak, true);
  assert.equal(r.ok, false);
});

test("passes at 90% with no leaks", async () => {
  const cases: EvalCase[] = [...Array(10)].map((_, i) => ({ q: `q${i}`, group: "g", expect: ["X"] }));
  const r = await runEval(cases, async (q) => (q === "q0" ? [] : [chunk("X")]));
  assert.equal(r.score, 90);
  assert.equal(r.ok, true);
});

test("Arabic spellings of blocked places are caught", () => {
  assert.deepEqual(findBlocked("أريد زيارة أربيل"), ["Erbil"]);
  assert.deepEqual(findBlocked("رحلة إلى لاهور"), ["Lahore"]);
});
