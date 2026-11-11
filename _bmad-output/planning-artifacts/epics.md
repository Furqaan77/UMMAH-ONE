---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/specs/spec-rag-knowledge-base/SPEC.md
  - _bmad-output/planning-artifacts/architecture/architecture-UMMAH-ONE-2026-11-11/ARCHITECTURE-SPINE.md
---

# UMMAH-ONE - Epic Breakdown

## Overview

Stories for the RAG knowledge base. Built from the spec (CAP-1..7) and the architecture spine (AD-1..10).

## Requirements Inventory

### Functional Requirements

- FR1 (CAP-1): The team adds data with a file and one command.
- FR2 (CAP-2): Search by meaning plus keywords.
- FR3 (CAP-3): Filters by category, region, country and city.
- FR4 (CAP-4): Exact sources on every answer.
- FR5 (CAP-5): Test question set and a pass rate.
- FR6 (CAP-6): The best passages, enough for a complete answer.
- FR7 (CAP-7): Markdown, text, PDF, Word, Excel and CSV.

### NonFunctional Requirements

- NFR1: Local only (Ollama, 8 GB Mac).
- NFR2: English and Arabic questions.
- NFR3: The 6 removed places never return.
- NFR4: Answers only from the knowledge base; sources marked "to verify".

### Additional Requirements

- The website and app share `/api/chat`. The app needs no change.

### UX Design Requirements

- None. The chat UI is unchanged.

### FR Coverage Map

| FR | Story |
|---|---|
| FR1 | 1.1, 1.2 |
| FR2 | 2.1 |
| FR3 | 2.1 |
| FR4 | 1.1, 2.1 |
| FR5 | 3.1 |
| FR6 | 2.1 |
| FR7 | 1.3 |

## Epic List

1. Ingest: any file into the index
2. Search: hybrid retrieval in the chat
3. Quality: eval set

## Epic 1: Ingest

The team can turn data files into a searchable index with one command.

### Story 1.1: Chunks from Markdown, with categories and blocked places

As a team member,
I want Markdown files in `website/data/<category>/` turned into chunks,
So that the city guides and future files share one format.

**Acceptance Criteria:**

**Given** `website/data/travel/ALL-81-CITIES.md`
**When** the chunker runs
**Then** every city's sections become chunks with category `travel`, region, country, city, a stable id and source `<file> › <section> — to verify`
**And** a heading with a blocked place fails the run, and a mention in text prints a warning.

### Story 1.2: Embeddings, local index and `npm run ingest`

As a team member,
I want one command that embeds the chunks and saves the index,
So that new data is live without a code change.

**Acceptance Criteria:**

**Given** Ollama with `qwen3-embedding:0.6b`
**When** I run `npm run ingest`
**Then** `website/.data/index.json` holds every chunk with its vector and the model name
**And** a second run re-embeds only the changed chunks, and the report lists added, changed, removed and unreadable files.

### Story 1.3: PDF, Word, Excel and CSV parsers

As a team member,
I want to add data in any common format,
So that I don't have to convert files first.

**Acceptance Criteria:**

**Given** one test file each of .txt, .pdf, .docx, .xlsx and .csv in a data folder
**When** I run `npm run ingest`
**Then** each becomes chunks, keeping its headings or rows as section titles
**And** a file with no readable text is listed as unreadable.

## Epic 2: Search

The chat finds the right passages by meaning, with filters and exact sources.

### Story 2.1: Hybrid search in `/api/chat`

As a user,
I want answers built from the best-matching passages,
So that questions phrased in any way, in English or Arabic, get correct answers with sources.

**Acceptance Criteria:**

**Given** the built index
**When** I ask "somewhere peaceful by the sea in Türkiye"
**Then** only Türkiye chunks are returned, ranked by BM25 + vector fused with RRF (top 6)
**And** "Sources used (N)" shows `<file> › <section>`; an Arabic question finds the same chunks; blocked places never appear.

## Epic 3: Quality

### Story 3.1: Eval set and `npm run eval`

As the team,
I want a fixed test question set,
So that I know when new data or changes make search worse.

**Acceptance Criteria:**

**Given** `website/eval/questions.json` with at least 30 English and Arabic questions
**When** I run `npm run eval`
**Then** it prints hit@6 and lists the failed questions
**And** the current data scores 90% or more (estimate target).
