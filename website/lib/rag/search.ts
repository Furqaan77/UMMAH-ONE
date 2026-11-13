// Hybrid search over the ingested index (AD-5): BM25 + meaning, fused with reciprocal rank fusion.
import { existsSync, statSync } from "node:fs";
import { arabicHints } from "./arabic";
import { findBlocked, fold } from "./blocked";
import { embedQuery, ollamaEmbedder, type Embedder } from "./embed";
import { JsonStore, type Index } from "./store";
import type { Chunk } from "./types";

export const TOP_K = 6;
const RRF_K = 60;
const POOL = 50;
const MIN_COSINE = 0.3; // meaning matches weaker than this are ignored

export class IndexMissing extends Error {
  constructor() {
    super("Search index missing. Run npm run ingest.");
    this.name = "IndexMissing";
  }
}

// ---------- text ----------
const STOP = new Set(
  "a an the and or of to in on at for from with by is are was be do does i me my we you your it its this that what which who how where when can could should would will tell about any some there here please want like go visit best good most".split(
    " ",
  ),
);

export function tokens(s: string): string[] {
  return fold(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

function hasPhrase(text: string, phrase: string): boolean {
  if (!phrase) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(text);
}

// ---------- places and categories ----------
export type Place = { kind: "city" | "country" | "region"; value: string };

const ALIASES: Record<string, Place> = {
  turkey: { kind: "country", value: "Türkiye" },
  emirates: { kind: "country", value: "UAE" },
  "united arab emirates": { kind: "country", value: "UAE" },
  saudi: { kind: "country", value: "Saudi Arabia" },
  ksa: { kind: "country", value: "Saudi Arabia" },
  bosnia: { kind: "country", value: "Bosnia and Herzegovina" },
  macedonia: { kind: "country", value: "North Macedonia" },
  balkan: { kind: "region", value: "Balkans" },
  "middle east": { kind: "region", value: "Middle East and Gulf" },
  gulf: { kind: "region", value: "Middle East and Gulf" },
  "southeast asia": { kind: "region", value: "Southeast and South Asia" },
  "south asia": { kind: "region", value: "Southeast and South Asia" },
  zanzibar: { kind: "city", value: "Zanzibar City (Stone Town)" },
  dhahran: { kind: "city", value: "Dammam (Dhahran)" },
};

const CATEGORY_WORDS: Record<string, string[]> = {
  education: ["study", "studying", "student", "university", "universitie", "college", "degree", "school", "medicine", "master", "phd", "bachelor", "education", "campus"],
  food: ["food", "eat", "eating", "restaurant", "cuisine", "dish", "dishe", "meal", "dessert", "sweet", "breakfast", "street", "taste", "try"],
  clothes: ["clothe", "clothing", "fashion", "abaya", "wear", "modest"],
  handicraft: ["craft", "handicraft", "carpet", "calligraphy", "pottery"],
  heritage: ["heritage", "unesco", "monument"],
  // Art and culture (12 Nov 2026) covers culture, art, music, clothes, fashion, markets and handicrafts.
  culture: ["culture", "festival", "music", "art", "museum", "poetry", "dance", "theatre", "dervish", "clothe", "clothing", "fashion", "abaya", "kaftan", "modest", "market", "bazaar", "souk", "souq", "craft", "handicraft", "carpet", "calligraphy", "pottery", "silk", "embroidery", "perfume", "oud", "frankincense", "copperwork", "filigree", "leather", "batik", "buy", "buying", "shopping", "souvenir", "gift", "keepsake", "authentic", "genuine", "fake", "pearl", "pewter"],
  // Travel convenience guide (13 Nov 2026): how easy each place is to visit.
  travel: ["easy", "easiest", "easier", "convenient", "convenience", "accessible", "access", "reach", "transport", "taxi", "metro", "hardest", "difficult", "remote"],
  business: ["business", "shop", "brand", "artist", "seller"],
  about: ["ummah", "halal-friendliness", "label", "population"],
};

/** Name → place, built from the index (city names, their parts in brackets, countries, regions) plus aliases. */
function buildNames(chunks: Chunk[]): [string, Place][] {
  const m = new Map<string, Place>();
  const add = (name: string | undefined, p: Place) => {
    if (!name) return;
    const f = fold(name).trim();
    if (f.length > 2 && !m.has(f)) m.set(f, p);
  };
  for (const c of chunks) {
    const { city, country, region } = c.meta;
    if (city) {
      const p: Place = { kind: "city", value: city };
      add(city, p);
      for (const part of city.split(/[()]/)) add(part, p); // "Cappadocia (Göreme)" → cappadocia, goreme
      if (/ City$/.test(city.split(" (")[0])) add(city.split(" (")[0].replace(/ City$/, ""), p);
    }
    if (country) add(country, { kind: "country", value: country });
    if (region) add(region, { kind: "region", value: region });
  }
  for (const [k, p] of Object.entries(ALIASES)) if (!m.has(k)) m.set(k, p);
  // Longest names first, so "kuwait city" wins over "kuwait".
  return [...m].sort((a, b) => b[0].length - a[0].length);
}

// Place names that are also everyday English words: only match the exact spelling (e.g. "Malé", not "male").
const EXACT_ONLY = new Set(["male"]);
// Place names that are also common nouns (a kazan is a cooking pot): only a place after "in", "to", "visit"…
const PLACE_CONTEXT_ONLY = new Set(["kazan"]);
const PLACE_WORDS = "in|to|visit|visiting|from|about|around|near|at|of";

export function detectPlaces(q: string, names: [string, Place][]): Place[] {
  let text = fold(q);
  const raw = q.toLowerCase();
  const out: Place[] = [];
  for (const [name, p] of names) {
    if (EXACT_ONLY.has(name) && !raw.includes(p.value.toLowerCase())) continue;
    if (PLACE_CONTEXT_ONLY.has(name) && !new RegExp(`(^|\\s)(${PLACE_WORDS})\\s+${name}($|[^\\p{L}])|^${name}($|[^\\p{L}])`, "u").test(text)) continue;
    if (hasPhrase(text, name)) {
      out.push(p);
      text = text.replace(name, " "); // do not count "kuwait" again inside "kuwait city"
    }
  }
  return out;
}

export function detectCategories(q: string, available: Set<string>): string[] {
  const t = new Set(tokens(q));
  return Object.entries(CATEGORY_WORDS)
    .filter(([cat, words]) => available.has(cat) && words.some((w) => t.has(w)))
    .map(([cat]) => cat);
}

// ---------- index cache ----------
type Loaded = {
  path: string;
  mtimeMs: number;
  index: Index;
  docs: { tf: Map<string, number>; len: number }[];
  df: Map<string, number>;
  avgdl: number;
  names: [string, Place][];
  categories: Set<string>;
  regionOf: Map<string, string>; // city or country → region
  countryOf: Map<string, string>; // city → country
};
let cache: Loaded | null = null;

function docText(c: Chunk): string {
  return [c.title, c.section, c.meta.city, c.meta.country, c.meta.region, c.text].filter(Boolean).join("\n");
}

export function loadIndex(store = new JsonStore()): Loaded {
  if (!existsSync(store.path)) throw new IndexMissing();
  const mtimeMs = statSync(store.path).mtimeMs;
  if (cache && cache.path === store.path && cache.mtimeMs === mtimeMs) return cache;
  const index = store.load();
  if (!index) throw new IndexMissing();
  const df = new Map<string, number>();
  const docs = index.chunks.map((c) => {
    const tf = new Map<string, number>();
    const toks = tokens(docText(c));
    for (const w of toks) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    return { tf, len: toks.length };
  });
  const regionOf = new Map<string, string>();
  const countryOf = new Map<string, string>();
  for (const c of index.chunks) {
    if (c.meta.city && c.meta.country && !countryOf.has(c.meta.city)) countryOf.set(c.meta.city, c.meta.country);
    if (c.meta.region) {
      if (c.meta.city) regionOf.set(c.meta.city, c.meta.region);
      if (c.meta.country) regionOf.set(c.meta.country, c.meta.region);
    }
  }
  cache = {
    path: store.path,
    mtimeMs,
    index,
    docs,
    df,
    avgdl: docs.reduce((n, d) => n + d.len, 0) / Math.max(docs.length, 1),
    names: buildNames(index.chunks),
    categories: new Set(index.chunks.map((c) => c.category)),
    regionOf,
    countryOf,
  };
  return cache;
}

function countriesOf(places: Place[], L: Loaded): string[] {
  return [
    ...new Set(
      places.flatMap((p) => (p.kind === "country" ? [p.value] : p.kind === "city" && L.countryOf.has(p.value) ? [L.countryOf.get(p.value)!] : [])),
    ),
  ];
}

/** Places and their countries named in a text (English or Arabic), without searching. */
export function placesIn(text: string, store?: JsonStore): { places: Place[]; countries: string[] } {
  const L = loadIndex(store);
  const places = detectPlaces(`${text} ${arabicHints(text)}`, L.names);
  return { places, countries: countriesOf(places, L) };
}

// ---------- search ----------
export type SearchOptions = { k?: number; store?: JsonStore; embedder?: Embedder };
export type SearchResult = {
  chunks: Chunk[];
  places: Place[];
  /** Countries of the places asked about: named countries plus the country of each named city. */
  countries: string[];
  categories: string[];
  usedVectors: boolean;
  /** Removed places named in the question. When not empty, nothing else is searched. */
  blocked: string[];
};

export async function search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const k = opts.k ?? TOP_K;
  const L = loadIndex(opts.store);
  const chunks = L.index.chunks;
  const q = `${query} ${arabicHints(query)}`.trim();

  // Never search for a removed place.
  const blocked = findBlocked(q);
  if (blocked.length) return { chunks: [], places: [], countries: [], categories: [], usedVectors: false, blocked };

  const places = detectPlaces(q, L.names);
  const categories = detectCategories(q, L.categories);
  const askedCountries = countriesOf(places, L);

  // Place filter: matching city/country/region, region-level summaries of those places, and chunks with no place.
  const cities = new Set(places.filter((p) => p.kind === "city").map((p) => p.value));
  const countries = new Set(places.filter((p) => p.kind === "country").map((p) => p.value));
  const regions = new Set(places.filter((p) => p.kind === "region").map((p) => p.value));
  const nearRegions = new Set([...cities, ...countries].map((x) => L.regionOf.get(x)).filter(Boolean) as string[]);
  const passes = (c: Chunk) => {
    const { city, country, region } = c.meta;
    if (!city && !country && !region) return true;
    if (city && cities.has(city)) return true;
    if (country && countries.has(country) && (!cities.size || !city)) return true;
    if (region && regions.has(region)) return true;
    if (!city && region && nearRegions.has(region)) return true;
    return false;
  };
  let allowed = chunks.map((_, i) => i);
  if (places.length) {
    const f = allowed.filter((i) => passes(chunks[i]));
    // Only filter if some place-tagged chunk survives; otherwise search everything.
    if (f.some((i) => chunks[i].meta.city || chunks[i].meta.region || chunks[i].meta.country)) allowed = f;
  }
  allowed = allowed.filter((i) => !findBlocked(chunks[i].title).length);

  // BM25.
  const qt = [...new Set(tokens(q))];
  const N = chunks.length;
  const bm = allowed
    .map((i) => {
      const d = L.docs[i];
      let s = 0;
      for (const w of qt) {
        const f = d.tf.get(w);
        if (!f) continue;
        const n = L.df.get(w) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        s += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * d.len) / L.avgdl));
      }
      return { i, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, POOL);

  // Meaning (skipped if Ollama is down or the index was built with another model).
  let vec: { i: number; s: number }[] = [];
  let usedVectors = false;
  const embedder = opts.embedder ?? ollamaEmbedder();
  if (embedder.model === L.index.model) {
    try {
      const v = await embedQuery(embedder, q);
      const vn = Math.hypot(...v);
      vec = allowed
        .map((i) => {
          const c = chunks[i].vector!;
          let dot = 0;
          let cn = 0;
          for (let j = 0; j < c.length; j++) {
            dot += c[j] * v[j];
            cn += c[j] * c[j];
          }
          return { i, s: dot / (Math.sqrt(cn) * vn || 1) };
        })
        .filter((x) => x.s >= MIN_COSINE)
        .sort((a, b) => b.s - a.s)
        .slice(0, POOL);
      usedVectors = true;
    } catch (e) {
      console.warn(`[search] meaning search off: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    console.warn(`[search] index built with ${L.index.model}, but OLLAMA_EMBED_MODEL is ${embedder.model}. Run npm run ingest.`);
  }

  // Reciprocal rank fusion, plus a small boost for the asked-for category.
  const score = new Map<number, number>();
  const addRanks = (list: { i: number }[]) => list.forEach((x, r) => score.set(x.i, (score.get(x.i) ?? 0) + 1 / (RRF_K + r + 1)));
  addRanks(bm);
  addRanks(vec);
  if (categories.length) for (const i of score.keys()) if (categories.includes(chunks[i].category)) score.set(i, score.get(i)! + 1 / (RRF_K + 1));

  const top = [...score].sort((a, b) => b[1] - a[1]).slice(0, k).map(([i]) => chunks[i]);
  return { chunks: top, places, countries: askedCountries, categories, usedVectors, blocked: [] };
}

/** "Dubai, UAE › 20 Things to Do in Dubai" — what the user sees in "Sources used". */
export function label(c: Chunk): string {
  return c.title === c.section ? c.title : `${c.title} › ${c.section}`;
}
