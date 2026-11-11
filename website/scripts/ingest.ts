// npm run ingest — turn everything in data/ into the search index (.data/index.json).
import { join } from "node:path";
import { ollamaEmbedder } from "../lib/rag/embed";
import { formatReport, ingest } from "../lib/rag/ingest";
import { JsonStore } from "../lib/rag/store";

try {
  process.loadEnvFile(join(process.cwd(), ".env.local"));
} catch {
  // no .env.local: use defaults
}

async function main() {
  const report = await ingest({
    dataDir: join(process.cwd(), "data"),
    store: new JsonStore(),
    embedder: ollamaEmbedder(),
  });
  console.log(formatReport(report));
  process.exitCode = report.ok ? 0 : 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
