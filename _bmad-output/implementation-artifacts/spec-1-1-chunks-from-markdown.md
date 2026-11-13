---
title: 'Chunks from Markdown, with categories and blocked places'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '5a8d69fcffd24e7d56e2c68248e2ab6b114392c1'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The city guides are parsed by ad-hoc code inside `lib/kb.ts`, which only understands one file. Future data (new categories, other formats) has nowhere to go.

**Approach:** Add `lib/rag/`, which holds the shared Chunk/Section types, a Markdown/text parser, a chunker that turns any file in `website/data/<category>/` into Chunks, and the blocked-places check. Move the guides to `data/travel/ALL-81-CITIES.md`.

## Boundaries & Constraints

**Always:**
- Use the Chunk shape and the id/source formats from epic context.
- Category comes from the folder.
- Region, country and city come from headings only.
- Every source ends with "— to verify".

**Never:**
- No embeddings or index yet (Story 1.2).
- No PDF, Word or Excel (Story 1.3).
- Don't change chat retrieval (Story 2.1). The chat must keep working.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| City guides | `data/travel/ALL-81-CITIES.md` | Chunks for all 81 cities. Each city gives an overview chunk and a things-to-do chunk, with meta region/country/city | N/A |
| Long section | Section > 1,200 chars | Split at paragraph breaks; parts share the title, with ids suffixed `-2`, `-3` | N/A |
| Blocked heading | `## Lahore, Pakistan` | No chunks for that file | Throws `BlockedPlaceError` naming file and place |
| Blocked mention | Text mentions "Erbil" | Chunk kept | Warning returned with file + section |
| Empty file | `.md` with no text | No chunks | Throws `Unreadable` |
| File at data root | `data/x.md` (no category folder) | Skipped | Warning: "file must be inside a category folder" |

</frozen-after-approval>

## Code Map

- `website/lib/kb.ts` -- holds the current `loadGuides()` heading parsing. Reuse its region/city/country rules, and update its path to `data/travel/ALL-81-CITIES.md`. Leave everything else alone.
- `website/data/city-guides.md` -- the file to move (it's identical to ALL-81-CITIES.md).
- `website/lib/retrieve.ts` -- don't change.
- `website/package.json` -- no test runner yet. Add `tsx` 4.23.15 (dev) and a `test` script (`tsx --test`).

## Tasks & Acceptance

**Execution:**
- [x] `website/data/travel/ALL-81-CITIES.md` -- move it from `data/city-guides.md` -- this is the category folder layout.
- [x] `website/lib/kb.ts` -- update the read path -- so the chat keeps working.
- [x] `website/lib/rag/types.ts` -- add Chunk, Section, Unreadable and BlockedPlaceError -- the single shared shape.
- [x] `website/lib/rag/blocked.ts` -- add the 6 places and `findBlocked(text)` (whole word, accent-insensitive) -- one list.
- [x] `website/lib/rag/parsers/markdown.ts` -- `(path) => Section[]` from # headings; `.txt` is one section per blank-line-separated block under the file name -- the parser contract.
- [x] `website/lib/rag/chunk.ts` -- `chunkFile(dataDir, path)` and `chunkAll(dataDir)` returning `{ chunks, warnings }`: category, meta from headings, ids, sources, sha256 hash, splitting -- the chunker.
- [x] `website/lib/rag/chunk.test.ts` -- tests for every matrix row -- proves the edge cases.

**Acceptance Criteria:**
- Given the moved guides, when the chat is asked about Istanbul, then it answers as before.
- Given `chunkAll`, when run twice on the same data, then ids and hashes are identical.

## Implementation Notes

- Implemented inline (no subagent), on user's instruction to avoid helper agents.
- `vector` is optional on Chunk until Story 1.2 fills it.
- Title = the `##` item heading; section = the nearest heading. Real data: 322 chunks, 81 cities, 0 warnings, max 1,200 chars.
- `kb.ts`, README and BUILD_DECISIONS now point to `data/travel/ALL-81-CITIES.md`. Chat checked: still returns Istanbul sources.
- tsx 4.23.15 (dev) added; `npm test` = `tsx --test "lib/**/*.test.ts"`.

## Spec Change Log

## Review Triage Log

Inline review (blind, edge-case, verification-gap lenses by the main session).

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| A single line > 1,200 chars (e.g. PDF page) stays over the limit | medium | `split` only cut at blank lines and newlines | patch: `splitLong` at sentence/space; test added |
| Bad `.meta.json` crashes with an unclear JSON error | low | bare `JSON.parse` | patch: error names the file; test added |
| Split test only checked `-3` if a third part existed | medium (test gap) | `if (chunks[2])` | patch: 6 paragraphs, assert 3 parts |
| A `# Title` heading becomes "region" for `## Name, Place` items in non-travel files | medium | `placeMeta` uses path[0] | defer: meta.json `placeHeadings:false` covers it; revisit with first education file |
| `#` lines inside code fences read as headings | low | data is prose, no code fences | reject |

## Verification

**Commands:**
- `npm test` -- expected: all tests pass
- `npx tsc --noEmit` -- expected: no errors
