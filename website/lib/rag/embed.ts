// Embeddings through the local Ollama server (AD-7).

export type Embedder = { model: string; embed(texts: string[]): Promise<number[][]> };

export const DEFAULT_EMBED_MODEL = "qwen3-embedding:0.6b";
const BATCH = 32;

/** Qwen3-Embedding expects an instruction on queries only; documents are embedded as-is. */
export const QUERY_PREFIX = "Instruct: Given a travel or study question, retrieve passages that answer it\nQuery: ";

export class OllamaDown extends Error {
  constructor(url: string, cause: unknown) {
    super(`Cannot reach Ollama at ${url}. Start Ollama, then run again. (${cause instanceof Error ? cause.message : cause})`);
    this.name = "OllamaDown";
  }
}

export function ollamaEmbedder(opts: { model?: string; url?: string } = {}): Embedder {
  const model = opts.model || process.env.OLLAMA_EMBED_MODEL || DEFAULT_EMBED_MODEL;
  const url = opts.url || process.env.OLLAMA_URL || "http://localhost:11434";
  return {
    model,
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH) {
        let res: Response;
        try {
          res = await fetch(`${url}/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, input: texts.slice(i, i + BATCH) }),
          });
        } catch (e) {
          throw new OllamaDown(url, e);
        }
        if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${await res.text().catch(() => "")} (is "${model}" pulled? run: ollama pull ${model})`);
        const data = (await res.json()) as { embeddings: number[][] };
        out.push(...data.embeddings);
      }
      return out;
    },
  };
}

export async function embedQuery(embedder: Embedder, q: string): Promise<number[]> {
  return (await embedder.embed([QUERY_PREFIX + q]))[0];
}
