// Retrieval quality check (AD-10): does search return an expected source in the top results?
import type { Chunk } from "./types";

export type EvalCase = { q: string; group: string; expect?: string[]; none?: boolean };
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

export async function runEval(cases: EvalCase[], searchFn: (q: string) => Promise<Chunk[]>): Promise<EvalReport> {
  const groups: EvalReport["groups"] = {};
  const failures: EvalFailure[] = [];
  let passed = 0;
  let blockedLeak = false;
  let first = 0;
  let answerable = 0;
  for (const c of cases) {
    const got = await searchFn(c.q);
    const match = (ch: Chunk) => (c.expect ?? []).some((e) => name(ch).toLowerCase().includes(e.toLowerCase()));
    const hit = c.none ? got.length === 0 : got.some(match);
    if (!c.none) {
      answerable++;
      if (got[0] && match(got[0])) first++;
    }
    const g = (groups[c.group] ??= { total: 0, passed: 0 });
    g.total++;
    if (hit) {
      g.passed++;
      passed++;
    } else {
      if (c.none) blockedLeak = true;
      failures.push({ q: c.q, group: c.group, expected: c.none ? "no results" : (c.expect ?? []).join(" | "), got: got.map(name) });
    }
  }
  const score = cases.length ? Math.round((1000 * passed) / cases.length) / 10 : 0;
  const top1 = answerable ? Math.round((1000 * first) / answerable) / 10 : 0;
  return { total: cases.length, passed, score, top1, groups, failures, blockedLeak, ok: score >= PASS_MARK && !blockedLeak };
}

export function formatEval(r: EvalReport, k: number): string {
  const lines = [`Search quality: ${r.passed}/${r.total} = ${r.score}% (hit@${k}, pass mark ${PASS_MARK}%) → ${r.ok ? "PASS" : "FAIL"}`, `Right source first: ${r.top1}% (information only)`, ""];
  for (const [g, s] of Object.entries(r.groups)) lines.push(`  ${g.padEnd(10)} ${s.passed}/${s.total}`);
  if (r.blockedLeak) lines.push("", "A BLOCKED place returned results. This must be fixed.");
  if (r.failures.length) {
    lines.push("", "Failed questions:");
    for (const f of r.failures) lines.push(`  ✗ [${f.group}] ${f.q}`, `      expected: ${f.expected}`, `      got: ${f.got.join("; ") || "(nothing)"}`);
  }
  return lines.join("\n");
}
