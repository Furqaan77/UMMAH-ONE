# Start Here: Prompt for a New Machine or a New Claude Session

**How to use:** open the `UMMAH-ONE` folder in VS Code with Claude Code, then copy everything inside the box below and paste it as your first message.

---

```text
You are picking up the Ummah One project on a new machine (the Windows PC). The
previous work was done with Claude Code on a Mac. You have no memory of it: all the
context is in the files of this repo. Read them before doing anything else.

STEP 1 — Read these files fully, in this order:
  1. HANDOFF.md                — machines, people, rules, Windows setup, current state, next steps
  2. WORKLOG.md                — what was done each day and why (newest first)
  3. CLAUDE.md                 — working rules (loaded automatically, but read it again)
  4. PROJECT_CONTEXT.md        — history of the plan, mission, people, fact corrections
  5. BUILD_DECISIONS.md        — chatbot data and design decisions
  6. website/README.md         — how to run the website, the limits, the file map
  7. prompt.md and QUESTIONS.md — the product decisions (source of truth for the plan)
  8. sources/README.md         — the original PDFs behind the data (not read by the chatbot)
  9. planning/Local_Contributors_Brief.md — draft, with 5 open choices
 10. _bmad-output/implementation-artifacts/deferred-work.md — work put off for later

STEP 2 — Skim these to understand the design (read the parts you need):
  - _bmad-output/specs/spec-rag-knowledge-base/SPEC.md
  - _bmad-output/planning-artifacts/architecture/architecture-UMMAH-ONE-2026-11-11/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md and implementation-artifacts/sprint-status.yaml
  - _bmad-output/implementation-artifacts/spec-city-ratings.md, spec-rate-limits.md, spec-app-ratings.md
  - website/lib/rag/ (search, ingest, haram.ts halal filter, blocked.ts), website/lib/ratings/,
    website/lib/limits.ts and limits-config.ts, website/app/api/chat/route.ts
  - website/data/ (the 3 chatbot parts) and website/eval/questions.json (test questions)
  - app/ (Expo mobile app; uses the website's /api/chat)

STEP 3 — Reply to me with a short summary (tables and bullets, simple English):
  - who's who (owner, who decides, developer) and how I want you to work
  - the 3 chatbot parts and the rules built into the data (halal, no music for
    Saudi Arabia / Qatar / Kuwait, blocked places, team-only city labels)
  - what is built, what is open, and the next steps from HANDOFF.md section 8
  - anything in the files that looks out of date or contradicts something else
Do NOT change any file in this step.

STEP 4 — Then help me set up this PC, following HANDOFF.md section 4, one step at a
time. Check each step worked before the next. At the end, run in website\:
  npm test     (expected: all tests pass — 91 on 13 Nov 2026)
  npm run eval (expected: 87/87, pass mark 90%)
  npm run dev  (then open http://localhost:3000 and http://localhost:3000/admin)
Then test a few questions with qwen3:8b (English and Arabic), including
"Tell me about Konya" (the rating box should appear) and "Which places are most
enjoyable?" (it should say no city has been rated yet).

RULES (always):
  - Short replies, simple English, tables and bullets. No revenue planning unless asked.
  - Ask me questions one at a time, in plain chat (no pop-up question dialogs).
  - Don't invent facts. Mark estimates "estimate" and unchecked facts "to verify".
  - Nothing goes into the chatbot data until I have checked and confirmed it.
  - Ask before every git push. One approval doesn't carry over to the next.
  - Before starting work: git pull. After each session: add an entry at the top of
    WORKLOG.md, commit, and ask me before pushing.
  - Use BMAD (bmad-build skill in .claude/skills/) for new features.
  - My name is Bushra. Mr Tanveer is the project owner. Furqaan is the developer
    (GitHub account Furqaan77). Older files say "Furqaan" where they mean the person
    deciding; that is me.
```

---

## Notes

- **Kept in sync:** when the project changes, update `HANDOFF.md` and `WORKLOG.md`. This prompt only points to them, so it rarely needs changing; the test counts are the exception.
- **Claude memory is per machine:** the Mac's Claude memory doesn't travel. Everything needed is in these files.
- **Secrets are not in GitHub:** `website/.env.local` (passwords and keys) has to be created again on each machine. See HANDOFF.md section 4, step 5.
