// Saves one tester's answers for one city ("Help check the guide", 16 Nov 2026) to website/.data/guide-check.jsonl.
// Anonymous (Bushra's choice): no name, email or IP is stored. Nothing here changes the chatbot data;
// the team reviews the answers first.
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { cityGuides } from "@/lib/guide-check/content";
import { LABELS } from "@/lib/ratings/labels";
import { clientIp, limit, readJson, tooMany } from "@/lib/limits";

export const runtime = "nodejs";

const HOUR = 60 * 60 * 1000;
const MAX_TEXT = 4000;
const MAX_WHY = 1000;
/** Marks that disagree with the guide; only these can carry a "why" (23 Nov 2026). */
const DISAGREE = new Set(["wrong", "closed", "easier", "harder"]);
const THING = ["correct", "wrong", "closed", "unknown"] as const;
const BUY = ["correct", "wrong", "unknown"] as const;
const EASE = ["right", "easier", "harder", "unknown"] as const;
const HALAL = ["easy", "ok", "hard"] as const;

type Body = Record<string, unknown>;

const text = (v: unknown, max = MAX_TEXT) => (typeof v === "string" ? Array.from(v.replace(/\u0000/g, "").trim()).slice(0, max).join("") || null : null);
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null);

/** Each guide item with the tester's mark (unmarked items are left out), plus the reason for a disagreeing mark. */
function marks<T extends string>(items: string[], given: unknown, allowed: readonly T[], reasons?: unknown) {
  const arr = Array.isArray(given) ? given : [];
  const why = Array.isArray(reasons) ? reasons : [];
  return items.flatMap((item, i) => {
    const mark = pick(arr[i], allowed);
    if (!mark) return [];
    const w = DISAGREE.has(mark) ? text(why[i], MAX_WHY) : null;
    return [w ? { item, mark, why: w } : { item, mark }];
  });
}

export async function GET() {
  return Response.json({ cities: cityGuides() });
}

export async function POST(req: Request) {
  const rl = limit(`guide-check:${clientIp(req)}`, { hour: { max: 30, windowMs: HOUR } });
  if (!rl.ok) return tooMany(rl.retryAfter);
  const read = await readJson<Body | null>(req, 128 * 1024);
  if (!read.ok) return read.res;
  const b = (read.value ?? {}) as Body;

  const guide = cityGuides().find((c) => c.city === b.city);
  if (!guide) return new Response("Unknown city", { status: 400 });
  const month = Number(b.visitMonth);
  const year = Number(b.visitYear);
  const thisYear = new Date().getFullYear();
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < thisYear - 30 || year > thisYear)
    return new Response("Bad visit date", { status: 400 });

  const row = {
    at: new Date().toISOString(),
    lang: b.lang === "ar" ? "ar" : "en",
    city: guide.city,
    country: guide.country,
    visit: `${year}-${String(month).padStart(2, "0")}`,
    things: marks(guide.things, b.things, THING, b.thingsWhy),
    thingsMissing: text(b.thingsMissing),
    buy: marks(guide.buy, b.buy, BUY, b.buyWhy),
    buyMissing: text(b.buyMissing),
    halal: pick(b.halal, HALAL),
    halalNote: text(b.halalNote),
    ease: marks(guide.ease.map((e) => `${e.name} (${e.score}/10)`), b.ease, EASE, b.easeWhy),
    easeMissing: text(b.easeMissing),
    feel: pick(b.feel, LABELS),
    more: text(b.more),
  };
  const answered = row.things.length + row.buy.length + row.ease.length + [row.thingsMissing, row.buyMissing, row.halal, row.halalNote, row.easeMissing, row.feel, row.more].filter(Boolean).length;
  if (!answered) return new Response("Nothing to send", { status: 400 });

  const dir = path.join(process.cwd(), ".data");
  await mkdir(dir, { recursive: true });
  await appendFile(path.join(dir, "guide-check.jsonl"), JSON.stringify(row) + "\n");
  return Response.json({ ok: true });
}
