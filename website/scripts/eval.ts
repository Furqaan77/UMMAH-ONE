// npm run eval — score search on the fixed test questions in eval/questions.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatEval, runEval, type EvalCase } from "../lib/rag/eval";
import { IndexMissing, search, TOP_K } from "../lib/rag/search";

try {
  process.loadEnvFile(join(process.cwd(), ".env.local"));
} catch {
  // no .env.local: use defaults
}

async function main() {
  const cases = JSON.parse(readFileSync(join(process.cwd(), "eval", "questions.json"), "utf8")) as EvalCase[];
  const report = await runEval(cases, async (q) => (await search(q)).chunks);
  console.log(formatEval(report, TOP_K));
  process.exitCode = report.ok ? 0 : 1;
}

main().catch((e) => {
  console.error(e instanceof IndexMissing ? "No search index. Run npm run ingest first." : e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
