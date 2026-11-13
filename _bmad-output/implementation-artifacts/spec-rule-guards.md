---
title: 'Chat: fixed replies for blocked places and music in Saudi Arabia, Qatar, Kuwait'
type: 'bugfix'
created: '2026-11-13'
status: 'done'
route: 'oneshot'
baseline_commit: 'd498b0d'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** First live test on the Windows PC with `qwen3:8b` (13 Nov 2026):
- "Tell me about Lahore": search correctly returned 0 sources, but the model described Lahore from its own knowledge. Breaks the blocked-places rule and "answer only from the knowledge base".
- "What music can I enjoy in Riyadh?": the Riyadh data has no music, but the model invented live music in Diriyah and JAX District. Breaks the no-music rule for Saudi Arabia, Qatar and Kuwait (Bushra, 13 Nov).

**Approach:** Do not rely on the model for these two rules.
- A question naming a blocked place (English or Arabic) gets a fixed reply ("Ummah One does not cover X"), with no sources and no model call.
- A question asking about music (English or Arabic words) for a place in Saudi Arabia, Qatar or Kuwait (country or any of its cities, found from the index) gets a fixed reply, with no model call. "Oud" alone does not count (oud perfume).
- The system prompt also gets a no-music rule for those 3 countries, for questions that do not ask about music directly.
- Reply in the user's language. Route tests and unit tests guard both.

</frozen-after-approval>

## Implementation Notes

- BMAD's `render_skill.py` could not be run on the PC (blocked by the permission check), so this spec was written and followed by hand in the same format as `spec-app-ratings.md`.
- New `lib/rag/rules.ts`: `asksMusic` (English and Arabic words; "oud" left out on purpose), `noMusicCountries`, `NO_MUSIC_RULE`, `blockedReply`, `noMusicReply`.
- `lib/rag/search.ts`: `SearchResult` gains `blocked` and `countries` (from a new city → country map built from the index); new `placesIn(text)`.
- `app/api/chat/route.ts`: fixed replies (sources `[]`, one `text` event, no model call). A follow-up with no place uses the latest earlier user message that names one (blocked place or country).
- Surprise: putting the no-music rule in every prompt made `qwen3:8b` repeat it aloud ("Music in Istanbul … music in Saudi Arabia should not be mentioned"). The rule is now added only when it can matter: those countries asked about or in the sources, no place named, or a music question about a region.
- Verified: 95/95 tests (4 new, plus follow-up cases), eval 87/87, `tsc` and `eslint` clean, and live on the PC with `qwen3:8b`: Lahore, Riyadh music (EN), Doha music (AR), Jeddah music follow-up all get fixed replies; Konya, "most enjoyable", oud in Doha, Riyadh evening unchanged. `next build` not run (dev server was running).

## Review Triage Log

Self-review of the diff (no reviewer subagents in this session), 13 Nov 2026.

- **medium · patch:** a follow-up after a blocked place ("Tell me about Lahore" → "what food is there?") still reached the model. Now the earlier message's blocked place gives the fixed reply. Test added.
- **medium · patch:** the no-music rule in every prompt was repeated aloud for other cities. Now added only when relevant (see notes).
- **medium · defer:** music questions about a region ("music in the Gulf", "music in the Middle East") still reach the model, which adds facts that are not in the data and sometimes mentions the rule. A fixed reply would be wrong there (UAE, Oman, Jordan, Azerbaijan may have music). Part of the general "model uses outside knowledge" problem.
- **low · reject:** a music question naming both a no-music city and another city ("music in Dubai and Riyadh") gets the fixed reply for both. Rare; the safe side of the rule.
- **low · reject:** blocked-place names in the Arabic reply are in English letters. Same as the existing deferred item on Arabic city names.
