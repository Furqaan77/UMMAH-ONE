# CLAUDE.md

New session on a new machine? Paste **START_HERE_PROMPT.md** first. Then read **HANDOFF.md**: the machines, the setup, the current state and the next steps. Then **WORKLOG.md** for what was done and why. **PROJECT_CONTEXT.md** has the full history of the plan.

## People
- **Mr Tanveer**: project owner. **Bushra**: runs the sessions and makes the day-to-day decisions. **Furqaan**: developer (GitHub Furqaan77).

## Rules for working with Bushra
- Keep replies short. Simple English. Tables and bullets.
- Don't plan revenue or earnings unless asked.
- Ask questions one at a time in plain chat. Don't use pop-up question dialogs.
- Don't invent facts. Mark estimates "estimate" and unchecked facts "to verify".
- Plans are 4–5 pages maximum.
- Ask before every push; one approval doesn't carry over.
- Nothing goes into the chatbot data until Bushra has checked it. Halal only; no music for Saudi Arabia, Qatar, Kuwait.
- After each session, add an entry at the top of WORKLOG.md.

## Machines
- Windows PC runs the website, the Qwen models (Ollama) and the data. The Mac is for planning. They share work only through GitHub (`git pull` before, push after).

## Sources of truth
- **prompt.md**: master prompt and all Ummah One plan decisions. The plan is generated only from this file.
- **QUESTIONS.md**: answers to the question round.
- **Ummah_One_Plan.md / .pdf**: the current plan.
- **BUILD_DECISIONS.md**: chatbot data and design decisions.

## Rebuild the PDF
`python tools/md2pdf.py Ummah_One_Plan.md Ummah_One_Plan.pdf` (needs `pip install reportlab`)
