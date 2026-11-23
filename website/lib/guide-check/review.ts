// Review of tester answers ("Help check the guide") for the admin page /admin/guide. 17 Nov 2026.
// Mr Tanveer approves or rejects each item; Bushra (or Claude, with her OK) then publishes approved items
// by hand. Nothing here writes to the chatbot data (website/data/) or the search index.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export const ANSWERS_FILE = "guide-check.jsonl";
export const DECISIONS_FILE = "guide-check-decisions.jsonl";
export const MAX_DECISION_TEXT = 2000;

export type Kind = "thing" | "buy" | "ease";
export type NotePart = "thingsMissing" | "buyMissing" | "halalNote" | "easeMissing" | "more";
export type Decision = "approved" | "rejected";
export const NOTE_PARTS: NotePart[] = ["thingsMissing", "buyMissing", "halalNote", "easeMissing", "more"];

type Mark = { item: string; mark: string };
export type AnswerRow = {
  at: string;
  lang?: string;
  city: string;
  country?: string;
  visit?: string;
  things?: Mark[];
  buy?: Mark[];
  ease?: Mark[];
  halal?: string | null;
  feel?: string | null;
} & Partial<Record<NotePart, string | null>>;
export type DecisionRow = { at: string; key: string; decision: Decision; text: string | null };

/** newCounts: disagreeing marks (wrong, not open, easier, harder) from answers saved after the latest decision.
 *  Not empty = the item needs a fresh look. "Correct", "Feels right" and "Don't know" only confirm, so they don't count. */
export type ReviewItem = { key: string; kind: Kind; item: string; counts: Record<string, number>; decision: DecisionRow | null; newCounts: Record<string, number> };
export type ReviewNote = { key: string; part: NotePart; text: string; at: string; visit: string | null; lang: string; decision: DecisionRow | null };
export type CityReview = {
  city: string;
  country: string;
  answers: number;
  items: ReviewItem[];
  halal: Record<string, number>;
  feel: Record<string, number>;
  notes: ReviewNote[];
};

export const itemKey = (city: string, kind: Kind, item: string) => `${city}|${kind}|${item}`;
export const noteKey = (city: string, at: string, part: NotePart) => `${city}|note|${at}|${part}`;

const KINDS: [Kind, "things" | "buy" | "ease"][] = [["thing", "things"], ["buy", "buy"], ["ease", "ease"]];
const AGREE = new Set(["correct", "right", "unknown"]);
const bump = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

/** Group answers by city and item. The latest decision for each key wins. */
export function summarizeAnswers(rows: AnswerRow[], decisions: DecisionRow[]): CityReview[] {
  const latest = new Map<string, DecisionRow>();
  for (const d of decisions) latest.set(d.key, d); // appended in time order: later lines win
  const cities = new Map<string, CityReview & { byKey: Map<string, ReviewItem> }>();
  for (const r of rows) {
    let c = cities.get(r.city);
    if (!c) cities.set(r.city, (c = { city: r.city, country: r.country ?? "", answers: 0, items: [], halal: {}, feel: {}, notes: [], byKey: new Map() }));
    c.answers++;
    for (const [kind, field] of KINDS)
      for (const m of Array.isArray(r[field]) ? (r[field] as Mark[]) : []) {
        const key = itemKey(r.city, kind, m.item);
        let it = c.byKey.get(key);
        if (!it) {
          it = { key, kind, item: m.item, counts: {}, decision: latest.get(key) ?? null, newCounts: {} };
          c.byKey.set(key, it);
          c.items.push(it);
        }
        bump(it.counts, m.mark);
        if (it.decision && r.at > it.decision.at && !AGREE.has(m.mark)) bump(it.newCounts, m.mark); // ISO timestamps compare as text
      }
    if (r.halal) bump(c.halal, r.halal);
    if (r.feel) bump(c.feel, r.feel);
    for (const part of NOTE_PARTS) {
      const text = r[part];
      if (!text) continue;
      const key = noteKey(r.city, r.at, part);
      c.notes.push({ key, part, text, at: r.at, visit: r.visit ?? null, lang: r.lang ?? "en", decision: latest.get(key) ?? null });
    }
  }
  return [...cities.values()]
    .map((c): CityReview => ({ city: c.city, country: c.country, answers: c.answers, items: c.items, halal: c.halal, feel: c.feel, notes: c.notes }))
    .sort((a, b) => a.city.localeCompare(b.city));
}

/** Every key a decision may point at (so a decision can't be saved for an item that does not exist). */
export function knownKeys(review: CityReview[]): Set<string> {
  return new Set(review.flatMap((c) => [...c.items.map((i) => i.key), ...c.notes.map((n) => n.key)]));
}

/** Read a jsonl file. Missing file = empty; broken lines are skipped (and logged). */
export async function readJsonl<T>(file: string, valid: (x: unknown) => x is T): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const out: T[] = [];
  raw.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const x = JSON.parse(line);
      if (valid(x)) return out.push(x);
    } catch {}
    console.warn(`[guide-check review] skipped bad line ${i + 1} in ${path.basename(file)}`);
  });
  return out;
}

export const isAnswer = (x: unknown): x is AnswerRow => {
  const r = x as AnswerRow;
  return !!r && typeof r === "object" && typeof r.city === "string" && typeof r.at === "string";
};
export const isDecision = (x: unknown): x is DecisionRow => {
  const d = x as DecisionRow;
  return !!d && typeof d === "object" && typeof d.key === "string" && (d.decision === "approved" || d.decision === "rejected");
};

const dataDir = () => path.join(process.cwd(), ".data");

export async function loadReview(dir = dataDir()): Promise<CityReview[]> {
  const [rows, decisions] = await Promise.all([
    readJsonl(path.join(dir, ANSWERS_FILE), isAnswer),
    readJsonl(path.join(dir, DECISIONS_FILE), isDecision),
  ]);
  return summarizeAnswers(rows, decisions);
}

export async function appendDecision(d: DecisionRow, dir = dataDir()): Promise<void> {
  await mkdir(dir, { recursive: true });
  await appendFile(path.join(dir, DECISIONS_FILE), JSON.stringify(d) + "\n");
}
