---
title: 'Eval set and npm run eval'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '8ea122fbb4593e507daa43bfe4b4836345a995f9'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing tells the team whether search got better or worse after new data or code changes.

**Approach:** Add a fixed set of at least 30 English and Arabic test questions, each listing the sources it should find. `npm run eval` runs search on each one and prints hit@6, overall and per group, plus the failures. Blocked-place questions must return nothing.

## Boundaries & Constraints

**Always:**
- Measure the real `search()` against the real index.
- Every expected source must exist in the data; no invented facts.
- Exit code 1 when the score is under 90% or a blocked-place question returns any chunk.

**Never:**
- Don't call the chat model. This measures search, not the wording of answers.
- Don't change search to make one question pass (fix only real defects).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal | Index built | Prints hit@6 %, per-group scores, failed questions with what came back | Exit 0 if ≥ 90% |
| Low score | < 90% | Same report | Exit 1 |
| Blocked | "Tell me about Lahore" returns a chunk | Listed as a failure | Exit 1 |
| No index | No `.data/index.json` | "Run npm run ingest first" | Exit 1 |

</frozen-after-approval>

## Code Map

- `website/lib/rag/search.ts` -- `search(q)` returns `{ chunks }`. Match on `title`/`section`. Don't change it.
- `website/scripts/ingest.ts` -- copy its `.env.local` loading.

## Tasks & Acceptance

**Execution:**
- [x] `website/eval/questions.json` -- 30+ cases `{ q, group, expect: [title/section substrings, any match counts], none?: true }`.
- [x] `website/lib/rag/eval.ts` -- `runEval(cases, searchFn)` returning the report; pure, testable.
- [x] `website/lib/rag/eval.test.ts` -- scoring, blocked rule, exit rule.
- [x] `website/scripts/eval.ts` + `npm run eval`.
- [x] `website/README.md` -- how to use it.

**Acceptance Criteria:**
- Given the real index, when `npm run eval` runs, then it prints a score and exits 0 at ≥ 90%.

## Implementation Notes

- 44 cases in 8 groups: city, landmark (no city name), meaning, filter, education, about, Arabic, blocked. Every expected source was checked against the data with grep.
- Result on the real index: 44/44 = 100% hit@6; right source first 82.5% (reported for information).
- Writing the cases found a real gap: Arabic spellings of blocked places (e.g. أربيل) passed the block. Fixed in `blocked.ts` (Arabic substrings) with a test.

## Spec Change Log

## Review Triage Log

Inline review by the main session.

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| Arabic blocked-place names not blocked | high | "أريد زيارة أربيل" returned chunks before the fix | patch: BLOCKED_AR + test |
| hit@6 alone is lenient (100%) | medium | could hide ranking drops | patch: add "right source first" % to the report |
| Cases only cover the current data | low | expected | reject: README tells the team to add cases with new data |

## Verification

**Commands:**
- `npm test`, `npx tsc --noEmit` -- pass
- `npm run eval` -- score ≥ 90%
