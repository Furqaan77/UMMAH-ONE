- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-chunks-from-markdown.md`
  summary: In non-travel files, a top "# Title" heading is read as region when items look like "## Name, Place".
  evidence: placeMeta takes region from headingPath[0]; workaround is a .meta.json with placeHeadings:false. Revisit when the first education/business file arrives.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-hybrid-search-in-chat.md`
  summary: Follow-up questions ("what about food there?") are searched without the earlier messages, so the place is lost.
  evidence: route.ts calls search(last.content) only; fix by adding the previous user message when the last one names no place.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-hybrid-search-in-chat.md`
  summary: The 4B model sometimes adds small claims that are not in the context.
  evidence: "well-known for education in various fields" in the Cairo answer; measure in the Story 3.1 eval and tighten the prompt.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-pdf-word-excel-csv-parsers.md`
  summary: Upgrade Next.js 15.5.4 before launch: npm audit lists critical/high advisories (DoS, cache poisoning, middleware bypass, SSRF), plus postcss and sharp.
  evidence: npm audit --omit=dev on 11 Nov 2026. Pre-existing; not caused by the RAG work. exceljs pulls uuid <11.1.1 (moderate), used only by local ingest.
