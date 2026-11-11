import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "./ingest";
import { JsonStore } from "./store";
import { ollamaEmbedder, OllamaDown, type Embedder } from "./embed";

function fakeEmbedder(model = "fake"): Embedder & { calls: number; texts: number } {
  const e = {
    model,
    calls: 0,
    texts: 0,
    async embed(texts: string[]) {
      e.calls++;
      e.texts += texts.length;
      return texts.map((t) => [t.length, 1, 0]);
    },
  };
  return e;
}

function setup(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "ingest-"));
  const data = join(root, "data");
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(data, rel, ".."), { recursive: true });
    writeFileSync(join(data, rel), body);
  }
  return { data, store: new JsonStore(join(root, ".data", "index.json")) };
}

const A = "# Region — x\n## Town, Land\nAbout the town.\n### 20 Things to Do in Town\n1. Walk.";
const B = "# Region — x\n## Village, Land\nAbout the village.";

test("first run embeds everything and writes the index", async () => {
  const { data, store } = setup({ "travel/a.md": A, "travel/b.md": B });
  const emb = fakeEmbedder();
  const r = await ingest({ dataDir: data, store, embedder: emb });
  assert.equal(r.ok, true);
  assert.equal(r.written, true);
  assert.equal(r.embedded, 3);
  assert.deepEqual(r.added, ["travel/a.md", "travel/b.md"]);
  const idx = store.load()!;
  assert.equal(idx.model, "fake");
  assert.equal(idx.dims, 3);
  assert.ok(idx.chunks.every((c) => c.vector?.length === 3));
});

test("no change: nothing embedded", async () => {
  const { data, store } = setup({ "travel/a.md": A });
  await ingest({ dataDir: data, store, embedder: fakeEmbedder() });
  const emb = fakeEmbedder();
  const r = await ingest({ dataDir: data, store, embedder: emb });
  assert.equal(emb.calls, 0);
  assert.equal(r.embedded, 0);
  assert.deepEqual([r.added, r.changed, r.removed], [[], [], []]);
});

test("one section edited: only that chunk embedded", async () => {
  const { data, store } = setup({ "travel/a.md": A, "travel/b.md": B });
  await ingest({ dataDir: data, store, embedder: fakeEmbedder() });
  writeFileSync(join(data, "travel/a.md"), A.replace("About the town.", "About the town, now longer."));
  const emb = fakeEmbedder();
  const r = await ingest({ dataDir: data, store, embedder: emb });
  assert.equal(r.embedded, 1);
  assert.deepEqual(r.changed, ["travel/a.md"]);
  assert.equal(store.load()!.chunks.length, 3);
});

test("file deleted: its chunks are removed", async () => {
  const { data, store } = setup({ "travel/a.md": A, "travel/b.md": B });
  await ingest({ dataDir: data, store, embedder: fakeEmbedder() });
  rmSync(join(data, "travel/b.md"));
  const r = await ingest({ dataDir: data, store, embedder: fakeEmbedder() });
  assert.deepEqual(r.removed, ["travel/b.md"]);
  assert.ok(store.load()!.chunks.every((c) => c.file === "a.md"));
});

test("model changed: everything re-embedded", async () => {
  const { data, store } = setup({ "travel/a.md": A });
  await ingest({ dataDir: data, store, embedder: fakeEmbedder("m1") });
  const emb = fakeEmbedder("m2");
  const r = await ingest({ dataDir: data, store, embedder: emb });
  assert.equal(r.fullRebuild, true);
  assert.equal(r.embedded, 2);
  assert.equal(store.load()!.model, "m2");
});

test("unreadable file: others still ingested, run fails", async () => {
  const { data, store } = setup({ "travel/a.md": A, "travel/empty.md": "# Only heading\n" });
  const r = await ingest({ dataDir: data, store, embedder: fakeEmbedder() });
  assert.equal(r.ok, false);
  assert.equal(r.written, true);
  assert.deepEqual(r.added, ["travel/a.md"]);
  assert.match(r.unreadable[0], /^travel\/empty\.md: /);
});

test("blocked heading: index not written", async () => {
  const { data, store } = setup({ "travel/a.md": A, "travel/bad.md": "# Asia — x\n## Lahore, Pakistan\nText." });
  const r = await ingest({ dataDir: data, store, embedder: fakeEmbedder() });
  assert.equal(r.ok, false);
  assert.equal(r.written, false);
  assert.match(r.blocked[0], /bad\.md: blocked place "Lahore"/);
  assert.equal(existsSync(store.path), false);
});

test("Ollama down: clear error, index not written", async () => {
  const { data, store } = setup({ "travel/a.md": A });
  const emb = ollamaEmbedder({ url: "http://127.0.0.1:9", model: "x" });
  await assert.rejects(ingest({ dataDir: data, store, embedder: emb }), (e) => e instanceof OllamaDown && /Start Ollama, then run again/.test(e.message));
  assert.equal(existsSync(store.path), false);
});

test("damaged index file: full rebuild", async () => {
  const { data, store } = setup({ "travel/a.md": A });
  mkdirSync(join(store.path, ".."), { recursive: true });
  writeFileSync(store.path, "{broken");
  const r = await ingest({ dataDir: data, store, embedder: fakeEmbedder() });
  assert.equal(r.fullRebuild, true);
  assert.equal(store.load()!.chunks.length, 2);
});

test("embed model returns too few vectors: index not written", async () => {
  const { data, store } = setup({ "travel/a.md": A });
  const bad: Embedder = { model: "bad", embed: async () => [[1, 2, 3]] };
  await assert.rejects(ingest({ dataDir: data, store, embedder: bad }), /returned 1 vectors for 2 chunks/);
  assert.equal(existsSync(store.path), false);
});
