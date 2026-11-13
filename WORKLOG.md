# Work Log: Ummah One

Newest first. Each entry: what was done, the decisions taken (and by whom), and where it lives. Add a new entry at the top after each work session, on either machine.

---

## 13 Nov 2026 (Windows PC)

**Later on 13 Nov: 3 new guides added to the chatbot (Bushra's PDFs, now in `sources/`)**
- `culture/shopping-craft-guide.md`: what to buy in 76 cities, with "where it comes from" notes. Plus Malaysia's 20 crafts (also listed under Kuala Lumpur, Penang and Langkawi). The "before paying" advice is written once at the top.
- `travel/travel-convenience.md`: ease-of-visit scores out of 10 for 73 cities (about 20 places each, easiest first), plus country lists for Morocco and Malaysia. Each score is also given in words (very easy … very hard).
- Taken out (halal or no-music rule):
  - Ganja wine region, Rahovec wine region, Suhareka vineyards, Samarkand wine museum, Meram vineyards (Konya), Berenice Beach Club (Aqaba);
  - Maraya, Boulevard City and Riyadh Boulevard World (Riyadh), and the Sheikh Jaber Al-Ahmad Cultural Centre (Kuwait);
  - "tiramisu" (Malaysian chocolates) and "tankards" (pewter).
- Changed: "Oud" in Jeddah, Riyadh, Dammam and Doha now reads "Oud perfume".
- Found in the PDFs:
  - the travel guide repeats Dubai → Ganja twice (identical; used once);
  - 1,096 of 1,499 places have only a general note, and some notes clash with low scores; the two vague notes were dropped;
  - the numbering is not always in score order, so places are sorted by score;
  - the page header says "76-City Shopping & Craft Guide".
- Fixes:
  - the halal filter missed plural "vineyards"/"wineries" and named beach clubs, which also removed "Berenice Beach Club" from the old Aqaba guide;
  - the AI no longer adds its own "some stalls use pork" warnings;
  - the "keep it very simple" rule is stronger.
- Checks: ingest 758 chunks; tests 95/95; eval 99/99 (12 new cases); type-check clean.

**Setup (HANDOFF section 4), first session on the PC**
- Already installed: Git 2.55, Node 24.20, Python 3.12, NVIDIA driver 610.88. Installed: Ollama 0.40.16 (winget).
- Models: `qwen3:8b` (5.2 GB), `qwen2.5vl:7b` (6.0 GB), `qwen3-embedding:0.6b` (0.6 GB).
- `.env.local` created with the PC models and an admin password (kept on the PC only).
- `npm run ingest`: 545 chunks, 11 non-halal lines removed. Tests 91/91, eval 87/87. Chat and `/admin` run; admin login works.
- `npm audit`: 0 in the app's packages; 6 moderate in `minimatch` (lint tool only).

**Live tests with qwen3:8b**
- Good: Konya (rating box, no label), "most enjoyable" (no city rated yet), medicine universities, oud perfume in Doha. Answers take 1–6 s once the model is loaded (47 s the first time).
- Broken, now fixed: "Tell me about Lahore" was answered from the model's own knowledge; "music in Riyadh" got made-up live music.
- Still open (deferred): the model adds facts that are not in the data (e.g. "Istanbul is the capital" in Arabic; "music in the Gulf"); Arabic answers mix Latin letters into words.

**Decision (Bushra: "you decide")**
- Blocked places and music in Saudi Arabia, Qatar and Kuwait are answered in code with a fixed reply; the model is not asked. Spec: `_bmad-output/implementation-artifacts/spec-rule-guards.md`. Branch `fix/rule-guards`.
- Fixed reply texts are new wording for Bushra to check: "Ummah One does not cover [place]. Ask me about another city in the guide." and "Ummah One does not cover music in Saudi Arabia, Qatar or Kuwait. I can tell you about culture, art, heritage and markets there." (Arabic versions in `website/lib/rag/rules.ts`).
- Checks: tests 95/95, eval 87/87, type-check and lint clean.
- BMAD's render script could not run on the PC (permission check; `uv` not checked), so the BMAD spec format was followed by hand.

**Later on 13 Nov: new chat design (website)**
- From Bushra's 3 screenshots in `Desktop\Ummah One\PICS FOR DESIGN` (Gemini app). Style and layout only; Ummah One's own name and logo.
- New: floating round top-bar buttons; language picker under the title; new chat and chat options (share, delete) in a pill; welcome with quick options and example questions; read aloud; voice mode (speak → send → answer read aloud); feedback sheet for 👍 and 👎 with reason chips, a comment and an opt-in to save the question and answer; frosted "…" menu with time, show sources, report, model name, Longer, Shorter, Retry; "Ummah One is AI and can make mistakes" under the last answer; placeholder "Ask Ummah One".
- Left out: "Don't personalize" (Ummah One has no personalisation).
- Server: `/api/chat` accepts `style` (longer/shorter) and sends the model name; `/api/feedback` accepts `reasons` (kept inside `comment`, so the Supabase table does not change).
- Checks: tests 95/95, eval 87/87, type-check clean. Screenshots: `Desktop\Ummah One\UI-screenshots`. The mobile app (`app/`) still has the old design.

## 13 Nov 2026 (Mac)

**Later on 13 Nov:** `START_HERE_PROMPT.md` added: a copy-paste first message for Claude on the PC. It says which files to read, asks for a summary, then walks through setup and tests.

**Later on 13 Nov:** Rating box and limit messages added to the mobile app (BMAD `spec-app-ratings.md`, one-shot review: 12 findings, 7 fixed). Error messages are no longer sent back to the model (app and website). Website tests 91/91; app type-check OK; iOS bundle OK. Not yet tried on a phone.

**Later on 13 Nov:** Local contributors brief and agreement drafted (`planning/Local_Contributors_Brief.md`, PDF on the Mac Desktop) and waiting for Bushra's check. 5 open choices: ownership (licence or transfer), pay per country (10 AED an hour may be below some minimum wages — to verify), payment method, 10 pilot cities, governing law. `tools/md2pdf.py` now takes `PDF_FOOTER` and `PDF_TITLE`.

**Later on 13 Nov:** What to Buy finished for all 81 cities. The 9 missing cities were researched (her Art & Culture guide plus 35 web sources) and confirmed by Bushra. Halal and wildlife items were left out. Eval 87/87, tests 87/87. Source PDF: `sources/What-to-Buy-9-Cities.pdf`.

**Decisions (Bushra)**
- Mr Tanveer is the project owner, Furqaan is the developer (GitHub Furqaan77), and Bushra runs the sessions.
- The whole project will run on a Windows 11 PC (RTX 5060 8 GB, 16 GB RAM); the Mac is for planning only.
  - Models for the PC: `qwen3:8b`, `qwen2.5vl:7b`, `qwen3-embedding:0.6b` (to verify).
- No music for Saudi Arabia, Qatar and Kuwait ("purely religious places"). Removed:
  - Riyadh Season, the Abha summer festivals, Maraya concert hall, Winter at Tantora, the Katara amphitheatre and the Sheikh Jaber centre (opera house);
  - "oud" in Doha now says "oud perfume".
- City enjoyment labels: Very boring, Boring, Enjoyable, Most enjoyable.
  - No city is labelled at the start.
  - Visitors who tick "I have been to [city]" share their feeling under chat answers; the team decides each label by hand at `/admin`.
  - Only approved labels are shown, and the chatbot uses only these.
- Hosting step 1 (rate and size limits) approved. Model hosting is not chosen yet; recommended: hosted Qwen (DeepInfra or Alibaba).

**Work**
- Art and culture for all 81 cities from Bushra's PDF "Ummah One Art & Culture Guide 2026". Fixed broken letters, merged her lists and added "Good to know" facts. Commit `1d8875a`.
- City ratings (BMAD spec `spec-city-ratings.md`; 28 review findings, 17 fixed). Commits `db130db`, `fe4335e`. PR #1.
- PR #2: everything into `main`.
- Rate and size limits (BMAD spec `spec-rate-limits.md`; 21 findings, 16 fixed). Commit `ec69cfb`. PR #3.
  - chat: 20 a minute and 300 a day per IP;
  - ratings: 20 an hour;
  - feedback: 30 an hour;
  - admin login: 5 wrong passwords per 15 minutes;
  - sizes: photos up to 1.5 MB, messages up to 4,000 characters.
- Handoff files for the PC: `HANDOFF.md`, this `WORKLOG.md`, and updates to `CLAUDE.md` and `PROJECT_CONTEXT.md`. Decisions credited to Bushra.
- Source PDFs copied into `sources/` (not read by the chatbot), so the PC has them.
- Checks: 87/87 tests, eval 82/82, `next build` OK.

## 12 Nov 2026 (Mac)

**Decisions (Bushra)**
- The chatbot has 3 parts for now:
  1. Travel and heritage, as one part.
  2. Universities.
  3. Art and culture: culture, art and music; clothes, fashion and markets; handicrafts (carpets, calligraphy, crafts, perfume); plus What to Buy.
- The halal food PDF stays on the Desktop but is **not** in the chatbot.
- Heritage list: only the 24 places Bushra gave, in her wording.
- Universities: scores out of 10 on her 10 priorities for university students. 12 scores were changed, each with a reason.
- Suggestions should be commerce-minded (carpets, calligraphy, perfume, clothes), not generic (finding masjids, visas, Ramadan).

**Work**
- Heritage list and the University City Compass added; the education sample and the food data removed. Commit `189a5b8`.
- The Art and Culture part and What to Buy (72 cities plus 20 signature buys). Commit `44c38ac`.
- BMAD research draft for art and culture in 81 cities (`_bmad-output/research/art-culture-81/`). Commit `0b89035`.
- Answered: 10 cities with little for tourists to do (Kuwait City, Podgorica, Tetovo, Ganja, Shymkent, Dammam, Pristina, Dushanbe, Satun, Lakshadweep). This is a judgement from the guide's own ratings. It was later replaced by the visitor-ratings approach.

## 11 Nov 2026 (Mac)

**Decisions**
- Halal rule: never include food that might involve alcohol, pork or anything haram.
- Disputed foods, option c: remove horse meat (kazy) and fermented milks (kymyz/kumys, shubat); keep seafood.
- Use BMAD for the build. The RAG plan lives in `_bmad-output/`.

**Work**
- 81 city guides used as the travel data.
- RAG built, story by story:
  - chunking: `1c1fe45`;
  - embeddings and `npm run ingest`: `57373e8`;
  - hybrid search: `8ea122f`;
  - eval set: `12d2070`;
  - PDF, Word, Excel and CSV parsers: `f64a7b0`.
- Security: Next.js 15.5.29, `npm audit` 0. Commit `8937966`.
- Halal food data added (later removed on 12 Nov): `370d357`, `556b539`.

## 10 Nov 2026 (Mac)

**Decisions**
- 6 places removed for safety: Grozny, Makhachkala, Derbent, Srinagar, Erbil, Lahore. The travel list is now 81.
- Greeting: a time-based "Good morning / afternoon / evening" instead of "Assalamu alaikum".

**Work**
- The Ummah One plan, prompts, project context and tools: `60537c4`.
- The chat website (Next.js) and mobile app (Expo): `69a1357`.
- Local Qwen on an 8 GB Mac (4B Instruct, plus Arabic search): `90eeeb9`.

## 5–10 Nov 2026 (earlier sessions)

- The SME debate write-up, the Ummah One plan (prompt.md → Ummah_One_Plan.md/.pdf) and the fair model-test prompt. See `PROJECT_CONTEXT.md`.
