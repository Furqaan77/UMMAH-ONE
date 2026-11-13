# Ummah One — Website (chat)

The website chat for Ummah One. Next.js 15, TypeScript, plain CSS.
Design follows the Qwen chat screenshots: plain white, large bold text, grey user bubble, no AI bubble.

## Run it

**Windows PC (main machine from 13 Nov 2026):** follow `../HANDOFF.md` section 4 (models: `qwen3:8b`, `qwen2.5vl:7b`, `qwen3-embedding:0.6b`; then `npm run ingest`, `npm test`, `npm run eval`, `npm run dev`). The steps below are for the Mac.

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
| City ratings: "How did [city] feel to you?" under answers about one travel city (visitors tick "I have been to", pick Very boring / Boring / Enjoyable / Most enjoyable, optional comment) | Done. Inputs are private (`.data/place-ratings.json`, or Supabase). No city has a label until the team sets one at `/admin` |
| Phone OTP login + history in Supabase | Next. Tables are ready in `../supabase/schema.sql` |

## Limits (estimates; change them in `lib/limits.ts`)

| What | Limit per IP |
|---|---|
| Chat | 20 a minute, 300 a day |
| City ratings | 20 an hour |
| 👍 / 👎 feedback | 30 an hour |
| Admin login | At most 5 wrong passwords in any 15 minutes (a slot frees up 15 minutes after each wrong try) |
| Sizes | Chat body 4 MB, message 4,000 characters, photos JPEG/PNG/WebP up to 1.5 MB (2 per request), rating 4 KB, feedback 32 KB |

Over a limit: 429 with `Retry-After` (413 or 400 for size). The chat shows a friendly message in English or Arabic. Counters are in memory on one server; move them to Supabase or Redis when hosting is chosen.

The IP is read from `x-forwarded-for`, counting `TRUST_PROXY_HOPS` entries from the right (default 1: one proxy, such as the host, in front). Set it to match the hosting setup. With no proxy (this Mac), all visitors share one counter.

## Review city ratings (team)

1. Add `ADMIN_PASSWORD=<a long password>` to `.env.local` and restart `npm run dev`.
2. Open http://localhost:3000/admin and log in.
3. Read each city's votes and comments, then click a label to set it (or Clear). Only labels you set appear in the chat, and the chatbot uses only these.

## Files

| File | What it does |
|---|---|
| `components/Chat.tsx` | The whole chat screen |
| `app/globals.css` | The design system (colours, sizes, layout) |
| `app/api/chat/route.ts` | Finds sources, sends them to Qwen, streams the answer |
| `app/api/feedback/route.ts` | Saves 👍 / 👎 |
| `app/api/place-rating/route.ts`, `components/PlaceRating.tsx` | Visitor city ratings (one per city per device) |
| `app/admin/page.tsx`, `app/api/admin/*` | Team page: votes and comments per city; set or clear each city's label. Needs `ADMIN_PASSWORD` in `.env.local` |
| `lib/ratings/` | Labels, storage (Supabase or `.data/`), checks, admin password |
| `data/<category>/` | Team data. Travel: `travel/ALL-81-CITIES.md`. Education: `education/university-city-compass.md` (18 cities, scores out of 10). Art and culture: `culture/art-and-culture.md` (81 cities; no music for Saudi Arabia, Qatar, Kuwait) and `culture/what-to-buy.md` (72 cities). Sample: `about/`. Run `npm run ingest` after any change |
| `lib/rag/` | The RAG: parsers, chunker, embeddings, index, hybrid search |
| `scripts/ingest.ts` | `npm run ingest`: data → `.data/index.json` |
| `lib/i18n.ts` | English and Arabic text |
