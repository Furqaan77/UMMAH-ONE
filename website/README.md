# Ummah One — Website (chat)

The website chat for Ummah One. Next.js 15, TypeScript, plain CSS.
Design follows the Qwen chat screenshots: plain white, large bold text, grey user bubble, no AI bubble.

## Run it

1. Install Ollama: https://ollama.com/download
2. Get the models:
   ```
   ollama pull qwen3:4b-instruct   # 8 GB Mac (16 GB+: qwen3:8b)
   ollama pull qwen2.5vl:3b        # photos (16 GB+: qwen2.5vl:7b)
   ollama pull qwen3-embedding:0.6b  # search by meaning
   ```
3. Start the website:
   ```
   cd website
   npm install
   cp .env.example .env.local
   npm run dev
   ```
4. Open http://localhost:3000

If Ollama is not running, the chat shows "The AI model is offline".

## Add or change data

1. Put the file in `data/<category>/`, for example `data/travel/` or `data/education/`.
2. Run `npm run ingest`. Only new or changed parts are processed.
3. Read the report: added, changed, removed, **unreadable** and **blocked** files.

4. Run `npm run eval` to check search quality. It asks 44 fixed test questions in English and Arabic and must score 90% or more. Add your own questions to `eval/questions.json` when you add new data.

The search index is saved in `.data/index.json`. It is not committed; rebuild it with `npm run ingest`.

## What works now

| Feature | Status |
|---|---|
| Chat with local Qwen (streaming) | Done |
| Answers only from the knowledge base, "Sources used (N) >" | Done. Travel: 81 city guides (`data/travel/ALL-81-CITIES.md`). Education: sample from prompt.md. All "to verify" |
| English + Arabic, automatic + language button, right-to-left | Done |
| + menu: Plan a trip, Find a university, Find a business, Add a photo | Done (photos use Qwen2.5-VL) |
| Mic (browser speech-to-text) | Done (Chrome, Edge, Safari) |
| Copy, 👍, 👎 ("What was wrong?"), share, retry, report | Done. Feedback saved to `.data/feedback.jsonl`, or Supabase when set |
| Chat history in the ☰ menu, delete chat | Done, saved on this device for now |
| Phone OTP login + history in Supabase | Next. Tables are ready in `../supabase/schema.sql` |

## Files

| File | What it does |
|---|---|
| `components/Chat.tsx` | The whole chat screen |
| `app/globals.css` | The design system (colours, sizes, layout) |
| `app/api/chat/route.ts` | Finds sources, sends them to Qwen, streams the answer |
| `app/api/feedback/route.ts` | Saves 👍 / 👎 |
| `data/<category>/` | Team data. Travel: `travel/ALL-81-CITIES.md`. Samples: `education/`, `about/`. Run `npm run ingest` after any change |
| `lib/rag/` | The RAG: parsers, chunker, embeddings, index, hybrid search |
| `scripts/ingest.ts` | `npm run ingest`: data → `.data/index.json` |
| `lib/i18n.ts` | English and Arabic text |
