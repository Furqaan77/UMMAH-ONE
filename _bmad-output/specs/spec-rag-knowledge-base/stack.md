# Stack (how) — proposed, confirmed in Architecture

| Part | Choice | Why |
|---|---|---|
| Embeddings | Ollama `qwen3-embedding:0.6b` (setting `OLLAMA_EMBED_MODEL`) | Local, English + Arabic, small enough for 8 GB |
| Keyword search | BM25 over the same chunks | Exact names (cities, universities) |
| Merge | Reciprocal rank fusion of keyword + meaning results | Simple, no tuning |
| Filters | Metadata on each chunk: category, region, country, city | CAP-3 |
| Index | Local JSON file `website/.data/index.json`, built by `npm run ingest` | No database needed now |
| Later | Supabase pgvector, same chunk shape | Q9 decision |
| Eval | `npm run eval` over `website/eval/questions.json` | CAP-5 |
