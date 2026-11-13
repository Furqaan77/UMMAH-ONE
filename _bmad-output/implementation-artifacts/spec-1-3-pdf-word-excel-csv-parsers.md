---
title: 'PDF, Word, Excel and CSV parsers'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '12d20704eb71e439743bbd200cb79fc81eb864de'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Data "can come in any form" (Furqaan, Q-R1), but ingest only reads Markdown and text.

**Approach:** Add parsers for PDF, Word (.docx), Excel (.xlsx) and CSV behind the existing parser contract. Each one keeps the file's headings or table rows as section titles. Files that can't be read are reported, never skipped silently.

## Boundaries & Constraints

**Always:**
- Parsers only return sections.
- A scanned PDF, or a broken or empty file, is reported as Unreadable with the reason.

**Never:**
- No OCR.
- No changes to search.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PDF with headings | Large-type lines | One section per heading | N/A |
| PDF without headings | Plain pages | One section per page ("Page n") | N/A |
| Scanned PDF | No text layer | No chunks | Unreadable: "needs OCR" |
| Word | Heading styles, or all-bold short lines | Sections per heading; lists as "- " | Broken file → Unreadable |
| Excel | Header row + rows; several sheets | One section per row, "Column: value"; City/Country/Region columns set place | No rows → Unreadable |
| CSV | Header + rows, empty rows | Same as Excel; empty rows skipped | Header only → Unreadable |

</frozen-after-approval>

## Code Map

- `website/lib/rag/chunk.ts` -- the parser registry. The pipeline is now async.
- `website/lib/rag/types.ts` -- `Section.meta` (place from table columns).

## Tasks & Acceptance

**Execution:**
- [x] `website/lib/rag/parsers/pdf.ts` -- unpdf 1.9.1 text items; headings by font size (≥ 1.25 × body, ≤ 120 chars); pages otherwise.
- [x] `website/lib/rag/parsers/docx.ts` -- mammoth 1.13.0 → HTML → Markdown-like text → markdown sections.
- [x] `website/lib/rag/parsers/table.ts` -- exceljs 4.4.0 and papaparse 5.7.0; rows → sections.
- [x] `website/lib/rag/chunk.ts`, `ingest.ts` -- register the parsers; make the pipeline async.
- [x] `website/lib/rag/parsers.test.ts` + `fixtures/` -- every matrix row, plus one ingest-level test with all types.

**Acceptance Criteria:**
- Given one file of each type in data/, when `npm run ingest` runs, then each becomes chunks and the scan is listed as unreadable. Verified live: PDF → "Heritage of Bukhara", CSV → "Samarkand Paper Mill", Word → "Plov, Uzbekistan"; scanned.pdf listed as UNREADABLE. Test files removed afterwards.

## Implementation Notes

- Implemented inline. The spec was written after the code, because the user delegated the choice ("you decide"); the matrix matches what was built and tested.
- The parser contract became async (`Section[] | Promise<Section[]>`), and `chunkAll`/`chunkFile` are now async. This amends AD-2's signature, not its rule.
- `Section.meta` lets table columns set the place. This extends AD-3 (place from headings, meta.json, or table columns).
- Fixtures: food.docx (macOS textutil), PDFs (reportlab), crafts.csv; the xlsx is generated in tests.
- Tests 46/46; eval still 44/44.

## Spec Change Log

## Review Triage Log

Inline review by the main session.

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| Empty extra sheet changed every row title to "file › sheet" | medium | test failure | patch: name sheets only when more than one has data |
| Word files with bold lines instead of heading styles gave one big section | medium | the textutil fixture had no h-tags | patch: short all-bold paragraphs become headings when no real headings exist |
| Word bullets came through as "\t•\t" | low | mammoth output | patch: "- " |
| `npm audit`: Next.js 15.5.4 has known security advisories (pre-existing); uuid (via exceljs, ingest only) moderate | high (Next) / low (uuid) | npm audit | defer |
