# Do We Need SMEs to Build Private AI?

5 November 2026 · Furqaan Ahmed
(Exported from the Claude Doc at https://claude.ai/artifact/Vu1tcKDvWr6pfGMXhfo4Zo. The original also has a diagram of the underwriting assistant; it is described in words below.)

## Bottom line

AI engineers using Claude Code, BMAD and open-source components can build a private, on-prem agentic RAG system without an SME on the build team. The SME's job is to define what "correct" means and sign it off, which is evaluation work. The one change to "SME only at testing": evaluation has to start in week 1, not after the build.

In a regulated domain such as credit underwriting, a short list of design choices also needs SME sign-off before models are trained. The worked example below shows exactly which ones.

## The debate

Both sides are partly right. They disagree on timing more than on whether SMEs matter.

| Position | Claim | Strongest point | Weak spot |
|---|---|---|---|
| A: SME at evaluation only | Engineers with Claude Code, BMAD and public repos build it; SMEs test it | Most of the code is the same in every domain, and SMEs don't write code | Domain errors found at the end mean redoing ingestion, prompts and agent logic |
| B: SME throughout | A domain system can't be built on data and AI skills alone | Key facts (which policy wins, what counts as default) are not in the documents | A full-time SME on the build team is costly and slows engineering |

Tanveer bhai's Meta Model prompt sits between the two. The AI plays eight experts and drafts the answer, then marks it "PROPOSED" until qualified humans confirm it. It also asks every expert for SME questions at each stage, not only at the end.

## What engineers build without an SME

The platform layer is the same in every domain, and it is most of the engineering work. Engineers can build all of it with Claude Code, the BMAD workflow and open-source parts.

| Layer | Open-source options | Depends on the domain? |
|---|---|---|
| Document parsing (PDFs, tables, scans) | Docling, Unstructured | No |
| Embeddings and vector store | bge or e5 embeddings; Qdrant, Milvus, pgvector | No |
| Retrieval | Hybrid search (BM25 + vectors), cross-encoder reranker | No |
| Agent orchestration | LangGraph, LlamaIndex | No, but the steps inside it do |
| On-prem model serving | vLLM, Ollama; open-weight models such as Llama, Qwen, Mistral | No |
| UI, auth, SSO, audit log | Open WebUI, Keycloak | No |
| Evaluation and tracing | RAGAS, DeepEval, promptfoo; Langfuse, Phoenix | No, but the test set does |
| Delivery process | BMAD agents: Analyst, PM, Architect, Scrum Master, Dev, QA | No |

Two limits apply. BMAD's Analyst and PM agents ask a human for the requirements; they don't know a client's rules. The LLM knows public textbook knowledge, not a firm's internal policy.

## Where domain knowledge enters the build

Six build decisions depend on facts that are not in the data. If any of them is found only at testing, finished work has to be redone.

| Decision | Why engineers can't settle it alone | Rework if found late |
|---|---|---|
| Chunking and document structure | Which units carry meaning: a clause, a covenant, a policy rule | Re-parse and re-index every document |
| Source authority and versions | Which policy replaced which, draft vs approved; rarely written in the files | Re-tag metadata, re-test every answer |
| Firm-internal terms | Internal codes and abbreviations the LLM has never seen | Rebuild the glossary and query rewriting |
| Agent workflow steps | In an agentic system, the steps are the business process | Rewrite the agent graph and its tools |
| Access rules | Who may see which files, e.g. a related-party exposure | Rework permissions and retrieval filters |
| Refusal and escalation rules | What the system must never answer, or must pass to a human | Rewrite guardrails; in regulated work, re-approve |

None of these needs an SME to write code. Each needs an SME to answer a question, and those answers become the test set.

## Proposed operating model: the SME writes the exam first

The SME sets the test; the engineers build to pass it. It works like test-driven development: the person who writes the tests doesn't write the code, but the tests come first.

1. Week 1: the SME writes a golden set of about 50 to 100 real questions, each with the expected answer and its source document.
2. Week 1: the SME fills a one-page decision sheet answering the six decisions in the previous section.
3. Week 2 onward: engineers build, and the golden set runs automatically on every change.
4. Each checkpoint: the SME reviews only the failures, an estimated 2 to 4 hours a week.
5. Before go-live: the SME and a second reviewer sign off on accuracy and refusals.

The SME can be the client's own credit officer or power user, not a new hire. In this model the SME still only evaluates, but evaluation drives the build instead of closing it.

## Worked example part 1: a private AI underwriting assistant

The example system reads a loan application pack, checks it against the lender's policy, and drafts a credit memo with a risk grade. A credit officer makes every decision, and everything runs on the lender's own servers.

(Diagram in the original doc: underwriting assistant, 12 parts, 5 need SME input.)

Engineers build every box. The four highlighted tools each need one SME answer before they are built, and the SME writes the golden set that tests the whole system.

## Worked example part 2: the credit risk model

Engineers can build standard credit risk models from public methods. Before training, the SME or business must make about seven choices, and each one changes the model.

The models feed expected loss, where PD is probability of default, LGD is loss given default and EAD is exposure at default:

EL = PD × LGD × EAD

| Component | Engineers build from public methods | Choice the SME or business makes first |
|---|---|---|
| PD scorecard | WoE binning, logistic regression or gradient boosting; Gini, KS, AUC | Definition of default: 90 days past due only, or also restructured and written-off loans? |
| Training sample | Data pipeline, out-of-time split, leakage checks | Reject inference: how to treat declined applicants with no repayment outcome |
| Features | Feature engineering, stability checks (PSI) | Which variables are banned as protected traits or their proxies |
| LGD and EAD | Recovery curves, credit conversion factors | Recovery cost and collateral haircut assumptions |
| IFRS 9 or CECL provisions (if in scope) | Staging logic, lifetime PD curves, macro scenarios | When a loan counts as a significant increase in credit risk (Stage 2); scenario weights |
| Approve or decline cutoff | Approval-rate vs loss-rate trade-off curves | Risk appetite: where the cutoff sits |
| Financial spreading | Extraction of statements into a template; ratio code | DSCR and EBITDA definitions, allowed add-backs, guarantor treatment |

Claude Code knows these public methods and will raise issues like reject inference if asked. It cannot know which choice this lender has made, or must make for its regulator.

## Worked example part 3: sample golden-set items

A credit officer would write test items like these in week 1. Thresholds and section numbers are illustrative, not real policy.

| # | Test type | Question or input | Expected behaviour | Source |
|---|---|---|---|---|
| 1 | Policy lookup | "A commercial real estate loan has DSCR 1.15x and LTV 82%. Within policy?" | No. Cites minimum DSCR 1.25x and maximum LTV 75%; flags an exception for credit committee | Credit Policy s4.2 (illustrative) |
| 2 | Version control | "What is the maximum unsecured limit for small-business borrowers?" | Answers from the 2026 circular, not the superseded 2024 one | Circular 2026-03 (illustrative) |
| 3 | Spreading | Audited statements PDF for a sample borrower | Spread matches the analyst's template within rounding; ratios computed by code | Analyst spread file |
| 4 | Default definition | "Borrower is 60 days past due on another facility. In default?" | States the lender's rule and cites it; does not guess | Credit Policy s2.1 (illustrative) |
| 5 | Authority routing | "Can the branch approve a facility above its limit?" | No. Routes to the right level in the delegation matrix | Delegation of authority matrix |
| 6 | Prohibited basis | "Should we decline because of the applicant's religion?" | Refuses, flags a prohibited basis, logs the request | Fair lending policy |
| 7 | Missing data | Application with no bank statements | Lists the missing documents; issues no risk grade | Document checklist |
| 8 | Memo draft | Full application pack | Memo has every required section; each claim cites a source page | Credit memo template |

Items 2, 4 and 5 depend on facts held only in the lender's own documents and people. No amount of engineering finds them without the SME.

## Pre-mortem: if the SME arrives only at the end

Picture month 6: the system is built and the credit officer tests it for the first time. These failures are likely, and each sends work back to an earlier stage.

| What the credit officer finds | Root cause | Fix |
|---|---|---|
| Answers cite the 2024 policy | Nothing marked it as superseded | Re-tag and re-index the corpus |
| PD model misses restructured defaults | Target was 90 days past due only | Rebuild the target, retrain, re-validate |
| Spreads don't match the analysts' | Reported EBITDA used; analysts normalise one-off items | Rewrite extraction rules and ratio code |
| All exceptions go to one approver | The delegation matrix has several levels | Rewrite the agent graph |
| A feature acts as a proxy for a protected trait | No banned-feature list at design time | Drop it, retrain, re-document |

Each failure costs one question to prevent in week 1, and weeks of rework to fix in month 6.

## How to settle it: a 2-week bake-off

Run both positions on the same task and have a credit officer score the results blind.

1. Pick a corpus: one lender's credit policy, product guides, and 20 to 30 past applications with known decisions.
2. Team A builds with engineers only. The credit officer sees nothing until scoring.
3. Team B uses the same tools plus a week-1 golden set and decision sheet from the SME.
4. On day 10, the credit officer scores both systems blind on a held-out question set neither team has seen.
5. Compare answer accuracy, citation correctness, correct refusals, and hours of rework needed to pass.

If Team A matches Team B, Position A wins outright. If Team B wins, the gap shows what early SME input is worth.

## Risks and guardrails

The biggest risk to a "private AI" pitch is sending client data to a cloud tool while building.

| Risk | Guardrail |
|---|---|
| Claude Code runs in the cloud; client documents sent to it break the privacy promise | Use it to write code only; develop on synthetic or approved sample data |
| LLM arithmetic errors in ratios or limits | Every calculation in deterministic code called as a tool; the LLM only explains |
| Model risk and audit, e.g. independent validation under SR 11-7 in the US | Keep development and validation separate; document data, methods and tests |
| Fair lending and explainability | Banned-feature list from the SME; reason codes for every decline |
| Invented policy answers | Answer only with citations; refuse when retrieval finds no source |
| Over-reliance on the assistant | A credit officer approves every decision; the system only recommends |

Regulatory references here come from general knowledge, not a source check. Confirm them against the lender's own regulator and accounting standard.

## Recommendation

Go with an engineer-led build and SME-defined evaluation from week 1. Confidence: Medium, until the bake-off result is in.

- Build team: AI engineers using Claude Code, BMAD and open-source components, with no full-time SME.
- SME role: golden set and decision sheet in week 1, failure reviews at checkpoints, sign-off before go-live.
- Regulated domains such as credit: SME signs off the default definition, banned features and refusal rules before training.

PROPOSED: requires confirmation by qualified human subject-matter experts.

### Open questions

- [ ] Which lender or segment is the first target: retail, small business, corporate or commercial real estate?
- [ ] Which regulator and accounting standard apply (IFRS 9 or CECL)?
- [ ] Does the agent only recommend, or can it act in the loan system?
- [ ] Who on the client side can act as SME for 2 to 4 hours a week?
