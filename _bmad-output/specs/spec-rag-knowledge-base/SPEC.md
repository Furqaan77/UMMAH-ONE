---
id: SPEC-rag-knowledge-base
companions: [stack.md, data-format.md]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Derived from `.memlog.md`.

# Ummah One RAG knowledge base

## Why

**Vision + pain.** Ummah One's chatbot must answer only from the team's own research, with sources. Today it uses simple keyword search over one file (81 city guides). The team will add more categories later (education, culture, food, clothes, heritage, handicraft, business). Keyword search misses questions phrased differently ("somewhere peaceful by the sea"), mixes up countries, and sends too much text to a small local model, so answers take 40–60 s. The RAG must find the right passages by meaning, grow by adding files, and stay fast on the owner's 8 GB Mac.

## Capabilities

- **CAP-1**
  - **intent:** The team adds data by putting a Markdown file in the data folder and running one command. No code change.
  - **success:** Add a test file with a new city; after the command, the chatbot answers a question about it with that file as a source.
- **CAP-2**
  - **intent:** The chatbot finds the right passages by meaning, not only by exact words (keyword + meaning search together).
  - **success:** On the test question set, the right passage is in the top 4 for at least 90% of questions (estimate target), including questions with no city name.
- **CAP-3**
  - **intent:** Results can be narrowed by category, region, country and city.
  - **success:** "Beaches in Türkiye" returns only Türkiye passages; "study in Cairo" returns education passages first.
- **CAP-4**
  - **intent:** Every answer cites its exact sources: file, section title, category.
  - **success:** The "Sources used (N) >" list names the city/section of each passage sent to the model.
- **CAP-5**
  - **intent:** Retrieval quality is measured with a fixed set of test questions, run after every data change.
  - **success:** One command prints a pass rate and lists failed questions.
- **CAP-6**
  - **intent:** The model gets the best passages, enough for a complete answer. Quality first; no speed target for now (Furqaan, 11 Nov).
  - **success:** On the test set, answers use the right passages and do not miss facts that are in them.
- **CAP-7**
  - **intent:** Any supported file (Markdown, text, PDF, Word .docx, Excel .xlsx, CSV) becomes searchable passages, keeping its headings or rows as section titles.
  - **success:** One test file of each type is ingested and answerable; an unreadable file is listed in the command's report, never skipped silently.

## Constraints

- Answer only from the knowledge base. If nothing fits: "I don't have that information yet. The Ummah One team is adding it." No outside knowledge.
- All team data is labelled "to verify" in sources.
- Runs locally: Ollama on the owner's Mac (M3, 8 GB RAM), text model `qwen3:4b-instruct`. No cloud AI now.
- English and Arabic questions must find the same content (content is in English).
- The 6 removed places (Grozny, Makhachkala, Derbent, Srinagar, Erbil, Lahore) never appear in data or answers.
- No visas, prices, maps, day-by-day itineraries, prayer times; no sectarian or political content.
- Website and mobile app share one backend (`website/api/chat`); the RAG lives there.
- Travel source is `ALL-81-CITIES.md` only (copied to `website/data/`). The PDF is not used.

## Non-goals

- Writing or researching content: the team adds data.
- Login, chat history in Supabase, SMS (waiting on keys).
- Cloud vector database now (Supabase pgvector comes when keys arrive).
- Training or fine-tuning a model.
- An upload page: only the team adds data, on this Mac (Furqaan, 11 Nov).
- Reading text from scanned PDFs (images only, needs OCR) in the first version: they are reported as unreadable.

## Success signal

- The team drops a new category file (e.g. education) into the data folder, runs one command, and the chatbot answers questions about it with correct sources, while the test set still passes.

## Assumptions

- Categories planned: travel (now), education, culture, food, clothes, heritage, handicraft, business.
- Index is a local file for now; it moves to Supabase pgvector later.
- Embedding model `qwen3-embedding:0.6b` (multilingual, ~640 MB) fits in 8 GB next to the 4B model.

