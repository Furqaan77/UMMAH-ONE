import { KB, type KbEntry } from "./kb";

// Simple keyword retrieval for the sample data.
// Swap for vector search (e.g. Supabase pgvector) when the real knowledge base arrives.

function words(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
}

const STOP = new Set(["the", "and", "for", "you", "can", "what", "how", "is", "in", "to", "of", "a", "me", "my", "i", "are", "do", "with", "about", "tell"]);

export function retrieve(query: string, k = 4): KbEntry[] {
  const q = words(query).filter((w) => !STOP.has(w));
  const ql = query.toLowerCase();
  if (q.length === 0) return [];

  const scored = KB.map((e) => {
    let score = 0;
    const kw = new Set(e.keywords);
    for (const w of q) if (kw.has(w)) score += 1;
    // Strong boost when the full city or title name appears in the question.
    const name = e.title.toLowerCase().replace(/^study in /, "");
    if (name.length > 2 && ql.includes(name.split("/")[0].trim())) score += 5;
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map((x) => x.e);
}
