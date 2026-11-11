// Retrieval quality check (AD-10): does search return an expected source in the top results?
import type { Chunk } from "./types";

export type EvalCase = { q: string; group: string; expect?: string[]; none?: boolean; category?: string; forbid?: string[] };
export type EvalFailure = { q: string; group: string; expected: string; got: string[] };
export type EvalReport = {
  total: number;
  passed: number;
  score: number; // 0–100
  top1: number; // % of answerable questions whose first result is expected (stricter, information only)
  groups: Record<string, { total: number; passed: number }>;
  failures: EvalFailure[];
  blockedLeak: boolean;
  ok: boolean;
};

export const PASS_MARK = 90;

const name = (c: Chunk) => `${c.title} › ${c.section}`;
const shown = (c: Chunk) => `${name(c)} [${c.category}]`;

export async function runEval(cases: EvalCase[], searchFn: (q: string) => Promise<Chunk[]>): Promise<EvalReport> {
  const groups: EvalReport["groups"] = {};
  const failures: EvalFailure[] = [];
  let passed = 0;
  let blockedLeak = false;
  let first = 0;
  let answerable = 0;
  for (const c of cases) {
    const got = await searchFn(c.q);
    // A case may also require the right category (e.g. a food answer must come from the food data).
    const match = (ch: Chunk) => (!c.category || ch.category === c.category) && (c.expect ?? []).some((e) => name(ch).toLowerCase().includes(e.toLowerCase()));
    // "forbid": none of the returned passages may contain these words (e.g. removed haram dishes).
    const leaked = (c.forbid ?? []).filter((f) => got.some((ch) => ch.text.includes(f)));
    const hit = c.none ? got.length === 0 : c.forbid ? leaked.length === 0 : got.some(match);
    if (!c.none && !c.forbid) {
      answerable++;
      if (got[0] && match(got[0])) first++;
    }
    const g = (groups[c.group] ??= { total: 0, passed: 0 });
    g.total++;
    if (hit) {
      g.passed++;
      passed++;
    } else {
      if (c.none || c.forbid) blockedLeak = true;
      failures.push({ q: c.q, group: c.group, expected: c.none ? "no results" : c.forbid ? `none of: ${leaked.join(", ")}` : `${(c.expect ?? []).join(" | ")}${c.category ? ` (from ${c.category})` : ""}`, got: got.map(shown) });
    }
  }
  const score = cases.length ? Math.round((1000 * passed) / cases.length) / 10 : 0;
  const top1 = answerable ? Math.round((1000 * first) / answerable) / 10 : 0;
  return { total: cases.length, passed, score, top1, groups, failures, blockedLeak, ok: score >= PASS_MARK && !blockedLeak };
}

export function formatEval(r: EvalReport, k: number): string {
  const lines = [`Search quality: ${r.passed}/${r.total} = ${r.score}% (hit@${k}, pass mark ${PASS_MARK}%) → ${r.ok ? "PASS" : "FAIL"}`, `Right source first: ${r.top1}% (information only)`, ""];
  for (const [g, s] of Object.entries(r.groups)) lines.push(`  ${g.padEnd(10)} ${s.passed}/${s.total}`);
  if (r.blockedLeak) lines.push("", "A BLOCKED place or a removed (not halal) item came back. This must be fixed.");
  if (r.failures.length) {
    lines.push("", "Failed questions:");
    for (const f of r.failures) lines.push(`  ✗ [${f.group}] ${f.q}`, `      expected: ${f.expected}`, `      got: ${f.got.join("; ") || "(nothing)"}`);
  }
  return lines.join("\n");
}
