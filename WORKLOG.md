# Work Log: Ummah One

Newest first. Each entry: what was done, the decisions taken (and by whom), and where it lives. Add a new entry at the top after each work session, on either machine.

---

## 13 Nov 2026 (Mac)

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
