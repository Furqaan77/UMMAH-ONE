# Project Context: Read This First

This folder holds everything needed to continue this work on any machine, with any account or any AI model. The work was done with Claude Code from 5 November 2026.

**New machine? Read `HANDOFF.md` first, then `WORKLOG.md`.** This file is the history of the plan (sections 3–8 describe 5–10 Nov).

## 1. People

| Who | Role |
|---|---|
| Mr Tanveer ("Tanveer bhai") | **Project owner.** Wrote the Meta Model test prompt (Meta_Model_Prompt.md). Is testing other AI models against Claude |
| Bushra | Runs the Claude sessions and makes the day-to-day decisions |
| Furqaan | Developer. GitHub account: Furqaan77 |
| Teammates | Argued that a domain AI can't be built without subject-matter experts (SMEs) |

Correction (13 Nov 2026, confirmed by Bushra): this file first named "Furqaan Ahmed" as the owner. Mr Tanveer is the owner, Furqaan is the developer, and Bushra is the person working with Claude. Below, "Furqaan" is the name used in the 5–10 Nov sessions for the person giving the answers.

## 2. How Bushra wants answers (follow this)

- **Short and simple.** Plain English, tables and bullets. Furqaan rejected a 26-page report as "too much English but of no use."
- **No money planning.** No revenue, pricing or earnings unless asked. ("I never asked you to make money.")
- **Ask questions one at a time, in chat.** Not as pop-up forms or tool dialogs. Furqaan answers with short letters like "a,b,d".
- **Don't invent facts.** Mark estimates as "estimate" and unchecked facts as "to verify".
- **Plans: maximum 4–5 pages.**
- Furqaan types fast and informally. Work out the intended meaning; ask only when it truly matters.

## 3. The three pieces of work, in order

### A. The SME debate (done)
- **Question:** can AI engineers using Claude Code, BMAD and public repos build an agentic RAG or private AI for any domain without SMEs?
- **Furqaan's position:** SMEs are needed only to evaluate and test the model, not while building it.
- **Test prompt:** Tanveer bhai's Meta Model prompt (Meta_Model_Prompt.md).
- **Output:** SME_Debate_Writeup.md. It uses a credit risk and underwriting example.
  - Online copy (owner's Claude account only): https://claude.ai/artifact/Vu1tcKDvWr6pfGMXhfo4Zo
- **Conclusion:** engineers build without an SME, but the SME writes the test set (a "golden set") in week 1, so evaluation drives the build. Labelled "PROPOSED — requires confirmation by qualified human subject-matter experts."

### B. Ummah One product plan (current main work)
- **Ummah One** is an AI guide built on RAG.
- **It encourages:**
  - well-off Muslims to travel to 87 Muslim cities
  - students to study in 18 education cities
  - people to support Muslim businesses and artists
- **Mission:** grow the Muslim economy (total GDP of OIC countries) 3X by 2034.
- **Promotion:** only through mosques where average family income is above $60,000.
- **How it was built:**
  1. Furqaan's raw brief (inside Fair_Test_Prompt.md)
  2. About 86 questions asked one by one in chat. The decisions are in QUESTIONS.md
  3. **prompt.md**, the master prompt holding every decision and all the data
  4. **Ummah_One_Plan.md**, the plan written only from prompt.md
  5. **Ummah_One_Plan.pdf**, 4 pages, made with tools/md2pdf.py
- **Earlier attempts (superseded; keep only for history):**
  - Ummah_One_Strategy_and_Decision_Memo.pdf: 26 pages. Rejected as too long and full of money planning.
  - Ummah_One_Product_Plan.pdf: 4 pages, made before the prompt.md approach. Replaced by Ummah_One_Plan.pdf.
- **Fact corrections already applied** (the original brief had these wrong):
  - The list has **87** travel places, not 100 or 75. Furqaan chose "87 places only."
  - **Update 10 Nov 2026:** 6 places removed for safety (terrorism / extreme violence): Grozny, Makhachkala, Derbent (Russia), Srinagar (India), Erbil (Iraq), Lahore (Pakistan). The list is now **81**. prompt.md is updated; Ummah_One_Plan.md/.pdf still say 87.
  - Lucknow is about 26% Muslim (city, 2011 census), not 40%.
  - Hyderabad is about 30% (city) and 43% (district).
  - Satun is 68–77% Muslim, depending on the source. No verified figure was found for Koh Lanta.
  - Universiti Malaya is 58th in QS 2026 and 56th in QS 2027, not "~59th".

### C. Model competition test (in progress)
- Tanveer bhai wants to see whether GPT Codex or DeepSeek can match Claude's result: a deep questionnaire, then a prompt.md, then a 4–5 page plan.
- Furqaan asked for weaker prompts for the other models. **Claude declined** because it would make the boss's test unfair and misleading. Claude made a fair test instead.
- **Fair_Test_Prompt.md** is the one prompt to give every model unchanged. It contains Furqaan's original brief, word for word, with its original errors left in, because catching them is part of the test.
- **Rules for a fair test:**
  - Answer every model's questions using the decisions in QUESTIONS.md, so all models get the same answers.
  - Tell the boss that Claude had an advantage: it saw Furqaan's earlier feedback ("no money", "include UK/Europe/US") before asking its questions.
- **Scorecard (score blind, without knowing which model made which plan):**

| Check | What a strong answer does |
|---|---|
| Depth of questions | Asks a lot, one at a time, covering scope, users, mosques, trust/feedback, AI sources, team, legal |
| Catches wrong facts | 87 places, not 100; Lucknow about 26%, not 40%; Universiti Malaya 58th in QS 2026 |
| Follows the rules | 4–5 pages, simple English, no revenue |
| Flags real risks | 3X needs about 17% growth a year; no education or heritage experts on the team; COPPA for under-13s |
| Consistency | The plan matches its own prompt.md and invents nothing |

## 4. Ummah One key decisions (summary; full detail in prompt.md)

| Area | Decision |
|---|---|
| Measure of 3X | Total GDP of OIC countries; launch 2027, goal 2034; needs about 17% growth a year |
| Organisation | Company with a social mission; not yet registered; 30 volunteers (travel experts plus engineers) |
| Launch | First version in 3 months (early February 2027); app, website, WhatsApp bot; English and Arabic |
| Users (priority order) | 1. Muslim businesses; 2. Contributors; 3. Families and travellers; 4. Students. Open to non-Muslims; under-18s allowed |
| City pages | Halal food, safety, budget, season, family and women ratings, heritage, culture, food, fashion, businesses, accessibility, events. No mosques or prayer times, visas, prices, maps, itineraries |
| Labels | Halal-friendliness: Bali, Kotor, Budva, Podgorica, Ohrid. Safety section: Srinagar, Grozny, Derbent, Makhachkala, Erbil |
| Trust | Phone OTP login; travel reviews need a photo taken at the place; badges and levels; **the team overrides everything, user feedback comes second** |
| AI | Claude in the cloud first, then Qwen or Llama on own servers; answers only from the knowledge base, with sources; no Wikipedia; hosting under $50,000 in year 1 |
| Mosques | Mosques only, no other partners. 50 mosques in year 1. Start with contacts in LA, London, Chicago, Michigan, Kuala Lumpur, Singapore, Kansas |
| Year-1 numbers | Money spent in the 87 cities (official city data), businesses listed and visited, students who applied, verified reviews, active users, verified trips |

## 5. Files in this folder

| File | What it is | Status |
|---|---|---|
| PROJECT_CONTEXT.md | This file | Read first |
| CLAUDE.md | Short instructions that Claude Code loads automatically | Current |
| prompt.md | Master prompt for the Ummah One plan | **Current: source of truth** |
| QUESTIONS.md | All of Furqaan's answers to the question round | **Current** |
| Ummah_One_Plan.md / .pdf | The 4-page plan made from prompt.md | **Current: final plan** |
| Fair_Test_Prompt.md | Prompt for testing other AI models | Current |
| Meta_Model_Prompt.md | Tanveer bhai's original test prompt | Reference |
| SME_Debate_Writeup.md | The SME debate write-up, with the credit risk example | Done |
| tools/md2pdf.py | Turns the plan .md into the styled PDF | Tool |
| Ummah_One_Product_Plan.pdf | Older 4-page plan | Superseded |
| Ummah_One_Strategy_and_Decision_Memo.pdf | Older 26-page memo | Superseded (rejected) |

## 6. How to rebuild the PDF

```
pip install reportlab
python tools/md2pdf.py Ummah_One_Plan.md Ummah_One_Plan.pdf
```
To change the plan: edit prompt.md, ask the AI to rewrite Ummah_One_Plan.md from it, then run the command above. The script uses Segoe UI on Windows or DejaVu Sans on Linux/Mac.

## 7. Method used

- **BMAD Method v6:** https://github.com/bmad-code-org/BMAD-METHOD. Uses the Analyst agent's product-brief workflow. The installer wasn't run; the workflow was followed by hand.
- **Approach:** ask every question first, write the decisions into prompt.md, then generate the plan only from prompt.md. Nothing goes into the plan that isn't in prompt.md.

## 8. Open items

- Run the model competition with Fair_Test_Prompt.md and score the results with the scorecard above.
- Before launch, have outside experts review the education and heritage pages; the team has none.
- Ask a lawyer about COPPA (users under 13) and minimal GDPR (consent, privacy policy, data deletion).
- Decide whether to delete the two superseded PDFs.
