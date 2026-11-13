// Summary chunks made from the data itself, so the AI can compare cities and list them.
// Rebuilt on every ingest, so they never drift from the source files.
import { sha256, slug } from "./chunk";
import type { Chunk } from "./types";

const RATING_LINE = /^(Calm|Character|Energy):\s*(.+)$/gm;

export function deriveChunks(chunks: Chunk[]): Chunk[] {
  const out: Chunk[] = [];
  const byFile = new Map<string, Chunk[]>();
  for (const c of chunks) {
    const k = `${c.category}/${c.file}`;
    (byFile.get(k) ?? byFile.set(k, []).get(k)!).push(c);
  }

  for (const [, cs] of byFile) {
    const { category, file } = cs[0];
    const make = (key: string, title: string, text: string, meta: Chunk["meta"]): Chunk => ({
      id: `${category}/${file}#${slug(key)}`,
      category,
      file,
      title,
      section: title,
      text,
      meta,
      source: `${file} › ${title} — to verify`,
      hash: sha256(JSON.stringify([category, file, title, text, meta])),
    });

    // One ratings table per region: "City, Country: Tranquility & Peace 7/10 · …".
    const ratings = new Map<string, string[]>();
    const seen = new Set<string>();
    for (const c of cs) {
      if (!c.meta.city || seen.has(c.meta.city)) continue;
      const lines = [...c.text.matchAll(RATING_LINE)].map((m) => m[2].trim());
      if (!lines.length) continue;
      seen.add(c.meta.city);
      const region = c.meta.region ?? "Other";
      (ratings.get(region) ?? ratings.set(region, []).get(region)!).push(`${c.meta.city}, ${c.meta.country}: ${lines.join(" · ")}`);
    }
    for (const [region, lines] of ratings)
      out.push(
        make(
          `ratings ${region}`,
          `${region}: city ratings`,
          `Ratings out of 10 for ${region} cities (Tranquility & Peace and Healing = calm; Traditional, Historic & Vintage, Cultural, Modern = character; Busy & Loud, Too Much Tourism = energy):\n${lines.join("\n")}`,
          { region },
        ),
      );

    // A list of every city in the file, grouped by region.
    const cities = new Map<string, Set<string>>();
    for (const c of cs) if (c.meta.city) (cities.get(c.meta.region ?? "") ?? cities.set(c.meta.region ?? "", new Set()).get(c.meta.region ?? "")!).add(c.meta.city);
    const total = [...cities.values()].reduce((n, s) => n + s.size, 0);
    // Only for region-grouped files (travel); a flat list (e.g. education) already has its own ranked list.
    if (total >= 5 && !cities.has("")) {
      const groups = [...cities].map(([r, s]) => `${r ? `${r} (${s.size}): ` : ""}${[...s].join(", ")}`);
      out.push(make(`all cities`, `All ${total} ${category} cities`, `Ummah One ${category} data covers ${total} cities:\n${groups.join("\n")}`, {}));
    }
  }
  return out;
}
