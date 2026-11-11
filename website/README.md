# Ummah One — Website (chat)

The website chat for Ummah One. Next.js 15, TypeScript, plain CSS.
Design follows the Qwen chat screenshots: plain white, large bold text, grey user bubble, no AI bubble.

## Run it

1. Install Ollama: https://ollama.com/download
2. Get the models:
   ```
   ollama pull qwen3:4b-instruct   # 8 GB Mac (16 GB+: qwen3:8b)
   ollama pull qwen2.5vl:3b        # photos (16 GB+: qwen2.5vl:7b)
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
| `data/travel/ALL-81-CITIES.md` | Travel data: 81 city guides (overview, ratings, 20 things to do). Replace this file to update travel answers |
| `lib/kb.ts` | Builds the knowledge base from the guides + 18 education cities |
| `lib/retrieve.ts` | Simple keyword search. Replace with vector search when real content arrives |
| `lib/i18n.ts` | English and Arabic text |
