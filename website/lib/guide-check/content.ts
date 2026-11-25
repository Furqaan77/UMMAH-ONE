// "Help check the guide" (Bushra, 16 Nov 2026): the guide's own items for each city, read from website/data.
// Testers mark each item; the team reviews the answers before anything changes in the chatbot data.
import { readFileSync } from "node:fs";
import path from "node:path";
import { removeHaramItems } from "../rag/haram";

export type EaseItem = { name: string; score: number; band: string };
/** intro: first paragraph of the city text. food: "### Food in X" list (Dubai so far). vibe: the Calm / Character / Energy lines. */
export type CityGuide = { city: string; country: string; things: string[]; buy: string[]; ease: EaseItem[]; intro: string; food: string[]; vibe: string[] };

const DATA = () => path.join(process.cwd(), "data");
const read = (rel: string) => readFileSync(path.join(DATA(), rel), "utf8").replace(/\r/g, "");

/** "## City, Country" sections of a Markdown file: city → lines. */
function sections(text: string): Map<string, { country: string; lines: string[] }> {
  const out = new Map<string, { country: string; lines: string[] }>();
  let cur: string[] | null = null;
  for (const line of text.split("\n")) {
    const h = /^## (.+),\s*([^,]+)$/.exec(line);
    if (h) {
      cur = [];
      out.set(h[1].trim(), { country: h[2].trim(), lines: cur });
    } else if (/^## /.test(line) || /^# /.test(line)) cur = null;
    else cur?.push(line);
  }
  return out;
}

const EASE = /^\d+\.\s+(.+?):\s*([\d.]+)\/10,\s*([^.]+)\./;

let cache: { at: number; cities: CityGuide[] } | null = null;

/** All cities with their things to do, what to buy and ease-of-visit items. Cached for a minute. */
export function cityGuides(): CityGuide[] {
  if (cache && Date.now() - cache.at < 60_000) return cache.cities;
  const travel = sections(read("travel/ALL-81-CITIES.md"));
  const shop = sections(read("culture/shopping-craft-guide.md"));
  const wtb = sections(read("culture/what-to-buy.md"));
  const conv = read("travel/travel-convenience.md");
  const ease = sections(conv);
  // Country lists (Morocco, Malaysia) for the cities without their own section.
  const countryEase = new Map<string, EaseItem[]>();
  for (const block of conv.split(/\n(?=## )/)) {
    const m = /^## (Morocco|Malaysia): /.exec(block);
    if (m) countryEase.set(m[1], parseEase(block.split("\n")));
  }

  const cities: CityGuide[] = [];
  for (const [city, { country, lines }] of travel) {
    // "### 20 Things to Do in X" (or "### Places to Visit in X", Dubai from 25 Nov 2026) sits inside the city section.
    const things = clean(subList(lines, /^### (20 Things to Do|Places to Visit)/));
    const food = clean(subList(lines, /^### Food in/));
    const vibe = lines.filter((l) => /^\*\*(Calm|Character|Energy):\*\*/.test(l)).map((l) => l.replace(/\*\*/g, "").trim());
    const intro = lines.find((l) => l.trim() && !l.startsWith("**") && !l.startsWith("#") && !/^\d+\.\s/.test(l) && l.trim() !== "---")?.trim() ?? "";

    let buy = (shop.get(city)?.lines ?? []).filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
    if (!buy.length) {
      const w = (wtb.get(city)?.lines ?? []).find((l) => l.startsWith("What to buy in"));
      if (w) buy = w.replace(/^What to buy in [^:]+:\s*/, "").replace(/\.$/, "").split(/,\s*/).filter(Boolean);
    }
    const where = (wtb.get(city)?.lines ?? []).find((l) => l.startsWith("Where to buy:"));
    if (where) buy.push(where.trim());

    let e = parseEase(ease.get(city)?.lines ?? []);
    if (!e.length) e = (countryEase.get(country) ?? []).filter((it) => it.name.toLowerCase().includes(city.toLowerCase()));
    cities.push({ city, country, things, intro, food, vibe, buy: removeHaramItems(buy.map((b) => `- ${b}`).join("\n")).text.split("\n").filter(Boolean).map((b) => b.slice(2)), ease: e });
  }
  cache = { at: Date.now(), cities };
  return cities;
}

/** Numbered items under a "### …" heading, up to the next heading. */
function subList(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const stop = rest.findIndex((l) => /^#{1,3} /.test(l));
  return (stop < 0 ? rest : rest.slice(0, stop)).filter((l) => /^\d+\.\s/.test(l));
}
const clean = (list: string[]) => removeHaramItems(list.join("\n")).text.split("\n").filter(Boolean).map((l) => l.replace(/^\d+\.\s+/, "").trim());

function parseEase(lines: string[]): EaseItem[] {
  return lines.map((l) => EASE.exec(l)).filter((m): m is RegExpExecArray => !!m).map((m) => ({ name: m[1].trim(), score: Number(m[2]), band: m[3].trim() }));
}
