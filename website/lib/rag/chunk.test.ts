import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chunkAll, chunkFile, MAX_CHARS } from "./chunk";
import { findBlocked } from "./blocked";
import { BlockedPlaceError, Unreadable } from "./types";

const DATA = join(process.cwd(), "data");

function tmpData(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "rag-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

test("city guides: all 81 cities, overview + things to do, with place meta", () => {
  const { chunks } = chunkAll(DATA);
  const travel = chunks.filter((c) => c.file === "ALL-81-CITIES.md");
  const cities = new Set(travel.map((c) => c.meta.city));
  assert.equal(cities.size, 81);
  for (const city of cities) {
    const mine = travel.filter((c) => c.meta.city === city);
    assert.ok(mine.some((c) => c.section === c.title), `${city}: overview`);
    assert.ok(mine.some((c) => /Things to Do/.test(c.section)), `${city}: things to do`);
  }
  const dubai = travel.find((c) => c.title === "Dubai, UAE")!;
  assert.deepEqual(dubai.meta, { region: "Middle East and Gulf", city: "Dubai", country: "UAE" });
  assert.equal(dubai.category, "travel");
  assert.match(dubai.id, /^travel\/ALL-81-CITIES\.md#/);
  assert.equal(dubai.source, "ALL-81-CITIES.md › Dubai, UAE — to verify");
  assert.ok(travel.every((c) => c.source.endsWith("— to verify")));
  assert.ok(travel.every((c) => c.text.length <= MAX_CHARS));
});

test("ids and hashes are stable across runs", () => {
  const a = chunkAll(DATA).chunks.map((c) => c.id + c.hash);
  const b = chunkAll(DATA).chunks.map((c) => c.id + c.hash);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length, "ids are unique");
});

test("long section is split at paragraph breaks with -2, -3 ids", () => {
  const para = "Word ".repeat(100).trim(); // ~500 chars
  const dir = tmpData({ "travel/long.md": `# R — x\n## Town, Land\n${Array(6).fill(para).join("\n\n")}` });
  const { chunks } = chunkFile(dir, join(dir, "travel/long.md"));
  assert.equal(chunks.length, 3);
  assert.ok(chunks.every((c) => c.text.length <= MAX_CHARS && c.title === "Town, Land"));
  assert.match(chunks[1].id, /-2$/);
  assert.match(chunks[2].id, /-3$/);
});

test("one very long line is still split under the limit", () => {
  const dir = tmpData({ "travel/line.md": `# R — x\n## Town, Land\n${"A short sentence here. ".repeat(200)}` });
  const { chunks } = chunkFile(dir, join(dir, "travel/line.md"));
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.text.length <= MAX_CHARS));
});

test("bad meta.json names the file", () => {
  const dir = tmpData({ "travel/m.md": "# A\nText", "travel/m.meta.json": "{oops" });
  assert.throws(() => chunkAll(dir), /m\.meta\.json: not valid JSON/);
});

test("blocked place in a heading fails the file", () => {
  const dir = tmpData({ "travel/bad.md": "# Asia — x\n## Lahore, Pakistan\nText." });
  assert.throws(() => chunkFile(dir, join(dir, "travel/bad.md")), (e) => e instanceof BlockedPlaceError && e.place === "Lahore");
  assert.throws(() => chunkAll(dir), BlockedPlaceError);
});

test("blocked place mentioned in text keeps the chunk and warns", () => {
  const dir = tmpData({ "travel/ok.md": "# Middle East — x\n## Duhok, Iraq\nA day from Erbil." });
  const { chunks, warnings } = chunkFile(dir, join(dir, "travel/ok.md"));
  assert.equal(chunks.length, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ok\.md › Duhok, Iraq: .*Erbil/);
});

test("blocked match is whole-word and accent-insensitive", () => {
  assert.deepEqual(findBlocked("GROZNY trip"), ["Grozny"]);
  assert.deepEqual(findBlocked("Lahorei"), []);
});

test("empty file is unreadable", () => {
  const dir = tmpData({ "travel/empty.md": "# Only a heading\n\n---\n" });
  assert.throws(() => chunkFile(dir, join(dir, "travel/empty.md")), Unreadable);
});

test("file at data root is skipped with a warning", () => {
  const dir = tmpData({ "x.md": "# A\nText", "travel/y.md": "# A\nText" });
  const { chunks, warnings } = chunkAll(dir);
  assert.equal(chunks.length, 1);
  assert.match(warnings.join("\n"), /x\.md: file must be inside a category folder/);
});

test("meta.json overrides place headings", () => {
  const dir = tmpData({
    "education/unis.md": "# Universities\n## Universiti Malaya, Kuala Lumpur\nText.",
    "education/unis.meta.json": JSON.stringify({ placeHeadings: false, city: "Kuala Lumpur", country: "Malaysia" }),
  });
  const { chunks } = chunkAll(dir);
  assert.deepEqual(chunks[0].meta, { city: "Kuala Lumpur", country: "Malaysia" });
  assert.equal(chunks[0].category, "education");
});

test("plain text: one section per block", () => {
  const dir = tmpData({ "food/notes.txt": "First block.\n\nSecond block." });
  const { chunks } = chunkAll(dir);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].section, "notes.txt");
  assert.notEqual(chunks[0].id, chunks[1].id);
});
