// Ingest pipeline: chunk → embed (only new/changed) → write index (AD-4).
import { chunkAllDetailed } from "./chunk";
import { deriveChunks } from "./derive";
import { canonicalizePlaces } from "./canon";
import type { Embedder } from "./embed";
import type { ChunkStore } from "./store";
import type { Chunk } from "./types";

export type IngestReport = {
  ok: boolean; // false → exit code 1
  written: boolean; // index file written
  model: string;
  chunks: number;
  embedded: number;
  added: string[];
  changed: string[];
  removed: string[];
  unreadable: string[];
  blocked: string[];
  warnings: string[];
  fullRebuild: boolean;
};

const fileKey = (c: Chunk) => `${c.category}/${c.file}`;

/** The text that gets embedded for a chunk. */
export function embedText(c: Chunk): string {
  return `${c.title === c.section ? c.title : `${c.title} — ${c.section}`}\n${c.text}`;
}

export async function ingest(opts: { dataDir: string; store: ChunkStore; embedder: Embedder }): Promise<IngestReport> {
  const { dataDir, store, embedder } = opts;
  const r = await chunkAllDetailed(dataDir);
  canonicalizePlaces(r.chunks);
  r.chunks.push(...deriveChunks(r.chunks));
  const report: IngestReport = {
    ok: true,
    written: false,
    model: embedder.model,
    chunks: r.chunks.length,
    embedded: 0,
    added: [],
    changed: [],
    removed: [],
    unreadable: r.unreadable,
    blocked: r.blocked,
    warnings: r.warnings,
    fullRebuild: false,
  };

  // A blocked place stops everything: the index is not written.
  if (r.blocked.length) return { ...report, ok: false };

  const prev = store.load();
  report.fullRebuild = !prev || prev.model !== embedder.model;
  const reuse = new Map<string, number[]>();
  if (prev && !report.fullRebuild) for (const c of prev.chunks) if (c.vector) reuse.set(c.id + c.hash, c.vector);

  // File-level diff for the report.
  const sig = (cs: Chunk[]) => {
    const m = new Map<string, string[]>();
    for (const c of cs) (m.get(fileKey(c)) ?? m.set(fileKey(c), []).get(fileKey(c))!).push(c.id + c.hash);
    return new Map([...m].map(([k, v]) => [k, v.sort().join("|")]));
  };
  const before = sig(prev?.chunks ?? []);
  const after = sig(r.chunks);
  for (const [k, v] of after) {
    if (!before.has(k)) report.added.push(k);
    else if (before.get(k) !== v) report.changed.push(k);
  }
  const unreadable = new Set(r.unreadableFiles);
  for (const k of before.keys()) if (!after.has(k) && !unreadable.has(k)) report.removed.push(k);

  // Embed only what is new or changed.
  const todo = r.chunks.filter((c) => !reuse.has(c.id + c.hash));
  const vectors = todo.length ? await embedder.embed(todo.map(embedText)) : [];
  if (vectors.length !== todo.length) throw new Error(`Embed model returned ${vectors.length} vectors for ${todo.length} chunks; index not written.`);
  todo.forEach((c, i) => (c.vector = round(vectors[i])));
  for (const c of r.chunks) if (!c.vector) c.vector = reuse.get(c.id + c.hash);
  report.embedded = todo.length;

  const dims = r.chunks[0]?.vector?.length ?? prev?.dims ?? 0;
  if (r.chunks.some((c) => c.vector?.length !== dims)) throw new Error("Embedding sizes differ between chunks; run again to rebuild.");

  const nothingChanged = !report.fullRebuild && !report.added.length && !report.changed.length && !report.removed.length;
  if (!nothingChanged || !prev) {
    store.write({ model: embedder.model, dims, builtAt: new Date().toISOString(), chunks: r.chunks });
    report.written = true;
  }
  report.ok = r.unreadable.length === 0;
  return report;
}

function round(v: number[]): number[] {
  return v.map((x) => Math.round(x * 1e6) / 1e6);
}

export function formatReport(r: IngestReport): string {
  const list = (label: string, xs: string[]) => (xs.length ? [`${label} (${xs.length}):`, ...xs.map((x) => `  - ${x}`)] : []);
  const lines = [
    `Model: ${r.model}${r.fullRebuild ? " (full rebuild)" : ""}`,
    `Chunks: ${r.chunks} · embedded now: ${r.embedded} · index ${r.written ? "written" : "not written"}`,
    ...list("Added files", r.added),
    ...list("Changed files", r.changed),
    ...list("Removed files", r.removed),
    ...list("UNREADABLE files", r.unreadable),
    ...list("BLOCKED (index not written)", r.blocked),
    ...list("Removed as not halal", r.warnings.filter((w) => w.startsWith("NOT HALAL")).map((w) => w.replace("NOT HALAL, removed: ", ""))),
    ...list("Warnings", r.warnings.filter((w) => !w.startsWith("NOT HALAL"))),
  ];
  if (!r.added.length && !r.changed.length && !r.removed.length && !r.fullRebuild && !r.blocked.length) lines.push("Nothing changed.");
  return lines.join("\n");
}
