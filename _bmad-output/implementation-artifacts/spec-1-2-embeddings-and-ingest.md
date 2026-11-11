---
title: 'Embeddings, local index and npm run ingest'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '1c1fe456595c9cbcda5c85879f82204860da9a65'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Chunks exist, but they carry no meaning vectors and aren't saved anywhere, so search can't use them.

**Approach:** One command, `npm run ingest`, does three things: chunks everything under `data/`, embeds only new or changed chunks with the local Ollama embedding model, and writes `.data/index.json`. It then prints a report.

## Boundaries & Constraints

**Always:**
- Only ingest writes the index.
- The index stores the embed model name and vector size. A different model means every chunk is re-embedded.
- Documents are embedded with no prefix. The embedded text is `title — section\ntext`.
- The report lists files added, changed, removed and unreadable, plus warnings.
- The write is atomic: a temp file, then rename.

**Never:**
- Don't change the chat (Story 2.1).
- No new file parsers (Story 1.3).
- No cloud calls.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First run | No index | All chunks embedded, index written, report shows all files added | N/A |
| No change | Same data | 0 chunks embedded; report says nothing changed | N/A |
| One file edited | One section changed | Only the changed chunks are embedded; file listed as changed | N/A |
| File deleted | File removed from data/ | Its chunks are gone from the index; file listed as removed | N/A |
| Model changed | `OLLAMA_EMBED_MODEL` differs from index | Everything re-embedded | N/A |
| Unreadable file | Empty `.md` | Other files still ingested; file listed as unreadable | Exit code 1 |
| Blocked heading | `## Lahore, Pakistan` | Index not written | Exit code 1, message names the file and place |
| Ollama down | Can't reach `OLLAMA_URL` | Index not written | Exit code 1: "Start Ollama, then run again" |

</frozen-after-approval>

## Code Map

- `website/lib/rag/chunk.ts` -- `chunkAll` throws on the first unreadable or blocked file. Ingest needs per-file results, so refactor to collect per-file errors: add `chunkAllDetailed` (or similar) returning `{ chunks, warnings, unreadable[], blocked[] }`, and keep the `chunkAll` behaviour for existing tests.
- `website/lib/rag/types.ts` -- Chunk.vector is already optional.
- `website/.env.local`, `website/.env.example` -- add `OLLAMA_EMBED_MODEL=qwen3-embedding:0.6b`.
- `website/app/api/chat/route.ts` -- reads `OLLAMA_URL` (default `http://localhost:11434`). Reuse the same default. Don't change it.
- `.gitignore` in `website/` -- check that `.data/` is ignored.

## Tasks & Acceptance

**Execution:**
- [x] `website/lib/rag/embed.ts` -- `embed(texts[], {model, url})` → `number[][]` via Ollama `/api/embed`, in batches of 32; `embedQuery(q)` adds the Qwen3 instruction prefix -- AD-7.
- [x] `website/lib/rag/store.ts` -- `ChunkStore` interface + `JsonStore(path)` with `load()` → `{ model, dims, builtAt, chunks }` | null and atomic `write()` -- AD-4, AD-6.
- [x] `website/lib/rag/ingest.ts` -- `ingest({ dataDir, store, embedder })` → report; reuse vectors by matching `id`+`hash`; diff files for added/changed/removed -- the pipeline; embedder injectable for tests.
- [x] `website/scripts/ingest.ts` + `package.json` script `ingest` -- loads `.env.local`, prints the report, sets the exit code -- the one command.
- [x] `website/lib/rag/ingest.test.ts` -- every matrix row, with a fake embedder and a temp store -- edge cases.
- [x] `website/.env.example`, `website/README.md` -- document the setting and the command.

**Acceptance Criteria:**
- Given Ollama with `qwen3-embedding:0.6b`, when `npm run ingest` runs on the real data, then `.data/index.json` holds 322 chunks, each with a vector of equal length.
- Given a second run with no changes, then it finishes without calling the embed model.

## Implementation Notes

- Implemented inline. `chunkAllDetailed` collects per-file problems; `chunkAll` unchanged.
- Real run: 322 chunks, vectors 1,024 long, 35 s first run, 0 embedded on the second. Index 3.3 MB (vectors rounded to 6 decimals).
- Spot check (cosine only): "silk road cities with madrasas" → Samarkand, Bukhara; Arabic "quiet place by the sea" → Hurghada, Sharm El Sheikh.
- `.data/` was already git-ignored.

## Spec Change Log

## Review Triage Log

Inline review by the main session.

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| Embedder returning fewer vectors crashes with an unclear TypeError | medium | `round(vectors[i])` on undefined | patch: count check, test added |
| Damaged index.json makes every later ingest crash | medium | bare `JSON.parse` in `load` | patch: warn + full rebuild, test added |
| A file listed both as unreadable and removed | low | was matched by basename | fixed before review: `unreadableFiles` keys |
| Two files with the same name in sub-folders of one category share ids | low | id uses basename | reject: no sub-folders in use; revisit if added |

## Verification

**Commands:**
- `npm test` -- expected: all pass
- `npx tsc --noEmit` -- expected: no errors
- `npm run ingest` (twice) -- expected: first run embeds 322 chunks, second embeds 0
