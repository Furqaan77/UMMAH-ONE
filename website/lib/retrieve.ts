import { KB, type KbEntry } from "./kb";

// Simple keyword retrieval.
// Swap for vector search (e.g. Supabase pgvector) when the real knowledge base arrives.

function words(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i");
}

// Whole-word match, so "Malé" does not match "female".
function hasPhrase(text: string, phrase: string): boolean {
  const i = text.indexOf(phrase);
  if (i < 0) return false;
  const before = text[i - 1] ?? " ";
  const after = text[i + phrase.length] ?? " ";
  return !/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after) ? true : hasPhrase(text.slice(i + 1), phrase);
}

const STOP = new Set(["the", "and", "for", "you", "can", "what", "how", "is", "in", "to", "of", "a", "me", "my", "i", "are", "do", "with", "about", "tell"]);

export function retrieve(query: string, k = 4): KbEntry[] {
  const q = words(query).filter((w) => !STOP.has(w));
  const qn = norm(query);
  if (q.length === 0) return [];

  const scored = KB.map((e) => {
    let score = 0;
    const kw = new Set(e.keywords);
    for (const w of q) if (kw.has(w) || kw.has(w + "s")) score += 1; // "Balkan" finds "Balkans"
    // Strong boost when the full city or title name appears in the question.
    const names = e.names ?? [e.title.replace(/^Study in /, "").split("/")[0].trim()];
    if (names.some((n) => n.length > 2 && (hasPhrase(qn, norm(n)) || (n.endsWith("s") && hasPhrase(qn, norm(n).slice(0, -1)))))) score += 5;
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map((x) => x.e);
}
