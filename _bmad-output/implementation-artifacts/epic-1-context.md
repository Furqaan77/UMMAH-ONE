# Epic 1 Context: Ingest

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The team turns data files into a searchable local index with one command, on the owner's Mac, without changing code. The data starts with 81 city guides and grows later: new categories, any common file type.

## Stories

- Story 1.1: Chunks from Markdown, with categories and blocked places
- Story 1.2: Embeddings, local index and `npm run ingest`
- Story 1.3: PDF, Word, Excel and CSV parsers

## Requirements & Constraints

- Only the team adds data, on this Mac: a file in `website/data/<category>/` plus one command. No upload page.
- Accepted types: Markdown, text, PDF, Word (.docx), Excel (.xlsx), CSV. Scanned PDFs are reported as unreadable.
- Unreadable files are always listed, never skipped silently.
- Everything runs locally (Ollama, 8 GB M3). No cloud.
- Every source is labelled "to verify".
- The 6 removed places (Grozny, Makhachkala, Derbent, Srinagar, Erbil, Lahore) must never enter the index as items.
- Answer quality comes before speed.

## Technical Decisions

- Pipes-and-filters: parse → chunk → embed → store. Parsers know formats; nothing else does.
- One `Chunk` shape for everything: `{ id, category, file, title, section, text, meta: { region?, country?, city? }, source, hash, vector }`.
- Parser contract: `(path) => Section[]`, with `Section = { headingPath: string[], text }`. A file with no text throws `Unreadable`.
- Category = the first folder under `website/data/`. Place metadata only from headings (`# Region — …`, `## City, Country`) or `<file>.meta.json`.
- id = `category/file#slug(headingPath)`; source = `<file> › <section> — to verify`.
- Chunk = one heading section, split at paragraph boundaries above ~1,200 characters.
- Index: `website/.data/index.json`, written only by ingest. It stores the embed model name. Only changed hashes are re-embedded.
- Embeddings: Ollama `/api/embed`, `OLLAMA_EMBED_MODEL` (default `qwen3-embedding:0.6b`). Documents are embedded with no prefix.
- Blocked places: one list in `lib/rag/blocked.ts`. A heading with a blocked place fails the run; a mention in text gives a warning.
- Code lives in `website/lib/rag/`; scripts in `website/scripts/`, run with tsx.

## Cross-Story Dependencies

- 1.2 uses the 1.1 chunker. 1.3 adds parsers behind the 1.1 contract.
- Epic 2 (search) reads the index from 1.2. Until then, the chat keeps its current keyword search.
