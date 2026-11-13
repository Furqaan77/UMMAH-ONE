---
title: 'Hybrid search in /api/chat'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '57373e8f1bf62cff65cee75b3d891df22f027e9a'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The chat still uses keyword-only search (`lib/retrieve.ts` over `lib/kb.ts`), so it misses questions worded differently and mixes up places.

**Approach:**
- Add `lib/rag/search.ts`, which runs keyword search (BM25) and meaning search (vectors) over the ingested index, merges the results with reciprocal rank fusion, and applies place and category filters taken from the question (English and Arabic). The top 6 chunks go to the model.
- Move the remaining sample content from `kb.ts` (education, about Ummah One) into data files. Ingest creates the region ratings tables and the "all cities" list from the data itself.
- Delete `kb.ts` and `retrieve.ts`.

## Boundaries & Constraints

**Always:**
- The model gets only chunks from the index; the refusal reply is unchanged.
- Every source is shown as `title › section` plus `<file> › <section> — to verify`.
- Chunks titled with a blocked place are dropped.
- If a filter matches no chunks, search everything instead.
- The website and the app keep the same `/api/chat` contract (`sources` event: `{id, title, source}`).

**Never:**
- No chat UI changes.
- No new parsers (Story 1.3).
- No eval suite (Story 3.1). A smoke check is enough here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Country filter | "somewhere peaceful by the sea in Türkiye" / "Turkey" | Only Türkiye chunks | N/A |
| Arabic | "أريد السفر إلى دبي" | Dubai chunks first | N/A |
| Category | "study in Cairo" | Education chunk for Cairo first | N/A |
| Comparison | "calmest city in the Balkans" | Balkans ratings table is in the results | N/A |
| No place | "old silk road cities" | Meaning search, any place (Samarkand/Bukhara) | N/A |
| Blocked | "Tell me about Grozny" | No Grozny chunk; model gives the refusal | N/A |
| No index | `.data/index.json` missing | Chat shows an error | Error event: "Search index missing. Run npm run ingest." |
| Ollama embed down | Embed call fails | Keyword search only | Logged, no crash |

</frozen-after-approval>

## Code Map

- `website/app/api/chat/route.ts` -- replace `retrieve()` with `await search()`, and build the context and sources from chunks.
- `website/lib/kb.ts` -- source of the education list, the halal-friendliness labels, the extra facts, the about text and the Arabic name maps. Move them out, then delete the file.
- `website/lib/retrieve.ts` -- delete.
- `website/lib/rag/ingest.ts` -- add derived chunks (region ratings, all-cities list) before embedding.
- `website/lib/rag/chunk.ts` -- `placeMeta`: a meta.json `regionFromHeading:false` option for non-region `#` titles (fixes the deferred item for these files).

## Tasks & Acceptance

**Execution:**
- [x] `website/data/education/education-cities-sample.md` (+ `.meta.json`) -- the 18 education cities from prompt.md, marked "sample, to verify".
- [x] `website/data/about/ummah-one.md` -- the about text, halal-friendliness labels and extra facts.
- [x] `website/lib/rag/arabic.ts` -- Arabic → English place names and topic words.
- [x] `website/lib/rag/derive.ts` + ingest -- region ratings and all-cities chunks.
- [x] `website/lib/rag/search.ts` -- index cache (reloads on change), BM25, cosine, RRF k=60, filters, blocked drop.
- [x] `website/lib/rag/search.test.ts` -- matrix rows with a fake index and embedder.
- [x] `website/app/api/chat/route.ts` -- use search; drop `kb.ts` and `retrieve.ts`.

**Acceptance Criteria:**
- Given the real index, when each matrix question is asked in the chat, then the sources match the matrix.

## Implementation Notes

- Implemented inline. Index now 356 chunks: 322 travel + 10 region ratings + 1 all-cities + education sample + about.
- Category is a ranking boost, not a hard filter (a hard filter would hide travel chunks for "study in Cairo"-style questions that also ask about the city).
- Chunks with no place meta (about, ranked lists) always pass the place filter.
- `EXACT_ONLY` stops "male" matching Malé.
- The context sent to the model tags each passage with its category: `[n] (education) Cairo, Egypt`.
- Live chat: "calmest Balkan city" → Ohrid 9/10 (checked against data); "study in Cairo" → Cairo University, Ain Shams; "Grozny" → refusal, 0 sources.
- `next build` not run, because the dev server is running (an earlier build clobbered it). The dev route works.

## Spec Change Log

## Review Triage Log

Inline review by the main session.

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| Duplicate "All 18 education cities" list next to the ranked list | low | derive ran on flat files | patch: only for region-grouped files |
| Travel and education chunks both labelled "Cairo, Egypt" to the model | medium | context had no category | patch: category tag in context |
| Male/Malé false match | medium | `fold("Malé") = "male"` | patch: EXACT_ONLY + test |
| Follow-up questions ("what about food there?") search only the last message | medium | route passes `last.content` | defer |
| Model adds small claims not in the context ("well-known in various fields") | medium | live answer | defer to Story 3.1 eval |
| Same title in "Sources used" for travel and education chunks | low | source line shows the file | reject |

## Verification

**Commands:**
- `npm test`, `npx tsc --noEmit`, `npm run ingest` -- all pass
- curl `/api/chat` with the matrix questions -- sources as expected
