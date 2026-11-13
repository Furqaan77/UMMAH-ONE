# HANDOFF: Read This First on a New Machine

For Bushra and any Claude session on the Windows PC. Updated 13 Nov 2026.

## 1. The setup

| Machine | Job |
|---|---|
| **Windows 11 PC** (Intel Core Ultra 5 225F, 16 GB RAM, NVIDIA RTX 5060 8 GB, 404 GB free) | Runs everything: the website, the Qwen models (Ollama), the data and the index |
| **Mac** (Apple M3, 8 GB) | Planning only (plans, specs, research, data drafts). Too small to run the models well |

Code and documents move between the two **only through GitHub**: https://github.com/Furqaan77/UMMAH-ONE

- Before you start on either machine: `git pull`.
- When you finish: commit and push (ask Bushra before every push).
- Work on one branch at a time from one machine, to avoid conflicts.

## 2. People

| Who | Role |
|---|---|
| **Mr Tanveer** ("Tanveer bhai") | Project owner |
| **Bushra** | Runs the Claude sessions and makes the day-to-day decisions |
| **Furqaan** | Developer. The GitHub account is **Furqaan77** |

Older files and commit messages say "Furqaan" where they mean the person making decisions. From 13 Nov 2026 the files say Bushra. Commits already on GitHub were not rewritten.

## 3. How to work with Bushra (rules)

- Short replies, simple English, tables and bullets.
- No revenue or earnings planning unless asked.
- Ask questions **one at a time**, in plain chat (no pop-up question dialogs).
- Don't invent facts. Mark estimates "estimate" and unchecked facts "to verify".
- Plans: 4–5 pages maximum.
- **Ask before every push.** One approval doesn't carry over to the next push.
- Use her own exact wording and only the places she gives when building lists.
- Nothing goes into the chatbot data until Bushra has checked and confirmed it.
- Halal rule: never include food or activities involving alcohol, pork or anything haram.
- No music for Saudi Arabia, Qatar or Kuwait ("purely religious places").
- Use BMAD (installed, 6.12.4) for new features: `bmad-build` skill. It is in `.claude/skills/`.

## 4. Set up the Windows PC (once)

1. Install:
   - **Git for Windows**: https://git-scm.com
   - **Node.js 24 LTS**: https://nodejs.org (the project was built on Node 24.14.1)
   - **Ollama for Windows**: https://ollama.com
   - **VS Code** and the **Claude Code** extension
   - Python 3 is optional; it's only needed for `tools/md2pdf.py`.
2. The NVIDIA driver is already there (version 610.88). Ollama uses the RTX 5060 by itself.
3. Get the code. In PowerShell:
   ```powershell
   cd $HOME\Desktop
   git clone https://github.com/Furqaan77/UMMAH-ONE.git
   cd UMMAH-ONE\website
   npm install
   ```
   Logging in: use the Furqaan77 account, or ask Furqaan to add Bushra's GitHub account under Settings → Collaborators.
4. Download the models (sizes are estimates, to verify):
   ```powershell
   ollama pull qwen3:8b               # chat, about 5 GB — fits the 8 GB graphics card
   ollama pull qwen2.5vl:7b           # photos, about 6 GB — swaps with the chat model
   ollama pull qwen3-embedding:0.6b   # search by meaning
   ```
   - Use `qwen3:8b`; the chat route turns thinking off.
   - If answers are slow, use `qwen3:4b-instruct` and `qwen2.5vl:3b` (the Mac's models).
5. Settings file:
   - Run `copy .env.example .env.local` in `UMMAH-ONE\website`.
   - Open `.env.local` and set:
     ```
     OLLAMA_URL=http://localhost:11434
     OLLAMA_MODEL=qwen3:8b
     OLLAMA_VISION_MODEL=qwen2.5vl:7b
     OLLAMA_EMBED_MODEL=qwen3-embedding:0.6b
     ADMIN_PASSWORD=<choose 12+ characters>
     ```
   - Keep `SUPABASE_*` empty for now.
   - Never commit `.env.local`.
6. Build the search index, then check it. Run each command in `website\`:
   - `npm run ingest`: builds `website\.data\index.json`. It isn't in git, so every machine builds its own.
   - `npm test`: expected 87 of 87 tests pass.
   - `npm run eval`: expected 82/82 (the pass mark is 90%).
   - `npm run dev`: then open http://localhost:3000 for the chat and http://localhost:3000/admin for ratings.

Windows notes:
- Line endings are fine: the parser reads both `\n` and `\r\n`.
- If PowerShell blocks `npm`, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## 5. What exists now (13 Nov 2026)

| Part | Where | Status |
|---|---|---|
| Chat website (Next.js 15.5.29, React 19) | `website/` | Done. English and Arabic; local Qwen through Ollama |
| Mobile app (Expo) | `app/` | Done, uses the same `/api/chat`. No rating box yet |
| RAG: ingest, hybrid search (BM25 + meaning, RRF), blocked places, eval | `website/lib/rag/`, `website/scripts/` | Done (BMAD stories 1.1–3.1) |
| Part 1: Travel and heritage | `website/data/travel/ALL-81-CITIES.md` | 81 cities plus 24 heritage places |
| Part 2: Universities | `website/data/education/university-city-compass.md` | 18 cities, scored out of 10 |
| Part 3: Art and culture | `website/data/culture/art-and-culture.md`, `what-to-buy.md` | 81 cities; What to Buy has 72 cities (9 need research) |
| City enjoyment ratings | `website/lib/ratings/`, `/admin` | Done. Visitors suggest; the team sets the label. No city labelled yet |
| Rate and size limits | `website/lib/limits.ts`, `limits-config.ts` | Done (hosting step 1) |
| Supabase (online storage, login) | `supabase/schema.sql` | Tables written; **keys not added yet** |

The rules are built into the data and code:
- **Halal filter at ingest** (`lib/rag/haram.ts`): pork, alcohol, horse meat and fermented milks are removed.
- **Blocked places never returned:** Grozny, Makhachkala, Derbent, Srinagar, Erbil, Lahore.

## 6. Files to read, in order

1. `HANDOFF.md`: this file
2. `WORKLOG.md`: what was done each day, with the reasons
3. `CLAUDE.md`: short rules that Claude Code loads automatically
4. `PROJECT_CONTEXT.md`: the full history of the plan (people, mission, decisions)
5. `BUILD_DECISIONS.md`: data and design decisions for the chatbot
6. `website/README.md`: how to run it, the limits, the file map
7. `_bmad-output/`: BMAD specs, architecture, epics and deferred work (`implementation-artifacts/deferred-work.md`)

## 7. Source documents

The original PDFs behind the data are in **`sources/`**; see `sources/README.md`. That folder isn't read by the chatbot.
- The halal food PDF is there but stays out of the chatbot.
- Only a design screenshot is left on the Mac (`Desktop/One Ummah/`).

## 8. Next steps (open)

| # | Step | Needs |
|---|---|---|
| 1 | Run everything on the PC (section 4) and check the answers with `qwen3:8b` | — |
| 2 | Hosting choice for launch. Recommended: hosted Qwen (DeepInfra or Alibaba), about $200–250 a month for 1,000 users (estimate, to verify) | Bushra's choice |
| 3 | Supabase: online ratings, chats, login. Move the rate-limit counters there. Set `TRUST_PROXY_HOPS` for the host | Supabase keys, SMS sender |
| 4 | Rating box in the mobile app | — |
| 5 | What to Buy: the 9 cities marked "needs research" | Bushra checks |
| 6 | Local contributors (photos and tips): contract and brief | Bushra's approval |
| 7 | The model's "brain": keep search plus rules, or fine-tune Qwen | Bushra's choice |
| 8 | Deferred work: UI tests for the rating box and limit messages | — |
