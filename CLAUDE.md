# CLAUDE.md

Read **PROJECT_CONTEXT.md** first. It has the full history, the people, every decision and the file map.

## Rules for working with Furqaan
- Keep replies short. Simple English. Tables and bullets.
- Don't plan revenue or earnings unless asked.
- Ask questions one at a time in plain chat. Don't use pop-up question dialogs.
- Don't invent facts. Mark estimates "estimate" and unchecked facts "to verify".
- Plans are 4–5 pages maximum.

## Sources of truth
- **prompt.md**: master prompt and all Ummah One decisions. The plan is generated only from this file.
- **QUESTIONS.md**: Furqaan's answers to the question round.
- **Ummah_One_Plan.md / .pdf**: the current plan.

## Rebuild the PDF
`python tools/md2pdf.py Ummah_One_Plan.md Ummah_One_Plan.pdf` (needs `pip install reportlab`)
