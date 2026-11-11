// One spelling per place across all files, so filters treat "Cappadocia / Göreme" and "Cappadocia (Göreme)",
// or "TÜRKIYE" and "Türkiye", as the same place. The spelling used by most chunks wins.
import { fold } from "./blocked";
import type { Chunk } from "./types";

export function placeKey(s: string): string {
  return fold(s).replace(/[()/,]+/g, " ").replace(/\s+/g, " ").trim();
}

export function canonicalizePlaces(chunks: Chunk[]): void {
  for (const field of ["city", "country", "region"] as const) {
    const votes = new Map<string, Map<string, number>>();
    for (const c of chunks) {
      const v = c.meta[field];
      if (!v) continue;
      const k = placeKey(v);
      const m = votes.get(k) ?? votes.set(k, new Map()).get(k)!;
      // ALL-CAPS spellings (PDF headings) never win against a normal spelling.
      m.set(v, (m.get(v) ?? 0) + (v === v.toUpperCase() && /\p{L}/u.test(v) ? 0.001 : 1));
    }
    const best = new Map([...votes].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]]));
    for (const c of chunks) {
      const v = c.meta[field];
      if (v) c.meta[field] = best.get(placeKey(v))!;
    }
  }
}
