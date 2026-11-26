// City overview reply (Bushra, 25 Nov 2026): "Tell me about Dubai" gets the city's own data, built in code
// (not by the model), as folded sections: Places to visit, Food, Shopping, Vibe. Clicking a heading opens it.
import { fold } from "../rag/blocked";
import type { CityGuide } from "./content";

export const OVERVIEW_HEADINGS = ["Places to visit", "Food", "Shopping", "Vibe"] as const;

// Words that may surround a city name in a plain "tell me about X" question.
const FILLER = /\b(please|pls|can|could|you|tell|me|more|about|what|whats|is|show|info|information|on|the|city|of|i|want|to|know|give|overview|guide)\b/g;

/** True when the message only asks about the city as a whole ("Tell me about Dubai, UAE", "Dubai?"). */
export function isOverviewQuestion(text: string, city: string, country: string): boolean {
  let t = ` ${fold(text).replace(/[’']/g, "")} `;
  const names = [city, city.replace(/\s*\(.*\)$/, ""), ...(/\((.+)\)/.exec(city)?.slice(1) ?? []), country].map(fold).filter(Boolean);
  for (const n of names.sort((a, b) => b.length - a.length)) t = t.split(n).join(" ");
  if (t === ` ${fold(text)} `) return false; // city not named in the text
  return t.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(FILLER, " ").trim() === "";
}

/** The overview as Markdown: a short intro, then one "## " section per heading that has data. */
export function cityOverview(g: CityGuide): string {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  const parts: string[] = [];
  if (g.intro) parts.push(g.intro);
  if (g.things.length) parts.push(`## Places to visit\n\n${list(g.things)}`);
  if (g.food.length) parts.push([`## Food\n\n${list(g.food)}`, ...(g.foodNotes ?? [])].join("\n\n"));
  if (g.buy.length) parts.push(`## Shopping\n\n${list(g.buy)}`);
  if (g.vibe.length) parts.push(`## Vibe\n\n${list(g.vibe)}`);
  parts.push("Open a heading to see more. Check official travel advice before you go.");
  return parts.join("\n\n");
}
