import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LABELS, isLabel, type EnjoymentLabel } from "./labels";

// Visitor ratings and team labels. Supabase (service role) when configured, else files in website/.data/
// (same pattern as app/api/feedback). Ratings are private: only the admin page reads them.

export type Rating = { device_id: string; city: string; label: EnjoymentLabel; visited: true; comment: string | null; created_at: string };
export type CitySummary = { city: string; counts: Record<EnjoymentLabel, number>; total: number; comments: { label: EnjoymentLabel; comment: string; created_at: string }[] };
export type Labels = Record<string, EnjoymentLabel>;

export interface RatingStore {
  addRating(r: Rating): Promise<void>;
  listRatings(): Promise<Rating[]>;
  getLabels(): Promise<Labels>;
  setLabel(city: string, label: EnjoymentLabel | null): Promise<void>;
}

/** Local files: one JSON array of ratings (upserted by device + city) and one city → label map. */
export class FileRatingStore implements RatingStore {
  constructor(private dir = join(process.cwd(), ".data")) {}
  private get ratingsPath() {
    return join(this.dir, "place-ratings.json");
  }
  private get labelsPath() {
    return join(this.dir, "place-labels.json");
  }
  // Only a missing file means "empty". A corrupt file throws, so it is never overwritten and lost.
  private async read<T>(path: string, fallback: T): Promise<T> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      throw e;
    }
    return JSON.parse(text) as T;
  }
  private async write(path: string, data: unknown) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 1) + "\n");
  }
  async addRating(r: Rating) {
    const all = (await this.listRatings()).filter((x) => !(x.device_id === r.device_id && x.city === r.city));
    all.push(r);
    await this.write(this.ratingsPath, all);
  }
  listRatings() {
    return this.read<Rating[]>(this.ratingsPath, []);
  }
  async getLabels() {
    return cleanLabels(await this.read<unknown>(this.labelsPath, {}));
  }
  async setLabel(city: string, label: EnjoymentLabel | null) {
    const labels = await this.getLabels();
    if (label) labels[city] = label;
    else delete labels[city];
    await this.write(this.labelsPath, labels);
  }
}

/** Supabase REST with the service role key (tables in supabase/schema.sql; RLS on, no policies). */
export class SupabaseRatingStore implements RatingStore {
  constructor(private url: string, private key: string) {}
  private async req(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(4000), // a slow Supabase must not hold up every chat answer
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => "")}`);
    return res;
  }
  async addRating(r: Rating) {
    await this.req("place_ratings?on_conflict=device_id,city", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(r),
    });
  }
  // Pages of 1,000: Supabase returns at most 1,000 rows per request by default.
  async listRatings() {
    const all: Rating[] = [];
    for (let from = 0; ; from += PAGE) {
      const page = (await (await this.req(`place_ratings?select=*&order=created_at.desc,id.desc&limit=${PAGE}&offset=${from}`)).json()) as Rating[];
      all.push(...page);
      if (page.length < PAGE) return all;
    }
  }
  async getLabels() {
    const rows = (await (await this.req("place_labels?select=city,label")).json()) as { city: string; label: EnjoymentLabel }[];
    return cleanLabels(Object.fromEntries(rows.map((r) => [r.city, r.label])));
  }
  async setLabel(city: string, label: EnjoymentLabel | null) {
    if (!label) {
      await this.req(`place_labels?city=eq.${encodeURIComponent(city)}`, { method: "DELETE" });
      return;
    }
    await this.req("place_labels?on_conflict=city", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ city, label, updated_at: new Date().toISOString() }),
    });
  }
}

const PAGE = 1000;

/** Keeps only real labels, so a bad stored value never reaches the prompt or the badge. */
export function cleanLabels(raw: unknown): Labels {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, l]) => isLabel(l))) as Labels;
}

export function ratingStore(): RatingStore {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? new SupabaseRatingStore(url, key) : new FileRatingStore();
}

/** Per-city counts and comments for the admin page, for every city given (cities with no ratings included). */
export function summarize(ratings: Rating[], cities: string[]): CitySummary[] {
  const empty = () => Object.fromEntries(LABELS.map((l) => [l, 0])) as Record<EnjoymentLabel, number>;
  const by = new Map<string, CitySummary>(cities.map((c) => [c, { city: c, counts: empty(), total: 0, comments: [] }]));
  for (const r of ratings) {
    const s = by.get(r.city);
    if (!s) continue;
    s.counts[r.label]++;
    s.total++;
    if (r.comment) s.comments.push({ label: r.label, comment: r.comment, created_at: r.created_at });
  }
  for (const s of by.values()) s.comments.sort((a, b) => b.created_at.localeCompare(a.created_at)); // newest first, any store
  return [...by.values()];
}
