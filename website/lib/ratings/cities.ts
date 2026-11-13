import { loadIndex } from "../rag/search";
import { findBlocked } from "../rag/blocked";
import { JsonStore } from "../rag/store";
import { isLabel, MAX_COMMENT, type EnjoymentLabel } from "./labels";

/** The travel cities (81), from the index: the only places that can be rated. */
export function travelCities(store?: JsonStore): string[] {
  const chunks = loadIndex(store).index.chunks;
  return [...new Set(chunks.filter((c) => c.category === "travel" && c.meta.city).map((c) => c.meta.city!))].sort();
}

/** The one city a chat answer is about, if the question names exactly one travel city. */
export function ratableCity(places: { kind: string; value: string }[], cities: string[]): string | null {
  const found = [...new Set(places.filter((p) => p.kind === "city").map((p) => p.value))];
  return found.length === 1 && cities.includes(found[0]) ? found[0] : null;
}

export type RatingInput = { deviceId?: unknown; city?: unknown; label?: unknown; visited?: unknown; comment?: unknown };
export type ValidRating = { deviceId: string; city: string; label: EnjoymentLabel; comment: string | null };

/** Checks a visitor rating. Returns the cleaned rating, or an error message for a 400. */
export function validateRating(input: RatingInput | null | undefined, cities: string[]): ValidRating | { error: string } {
  const b: RatingInput = input && typeof input === "object" ? input : {};
  if (typeof b.deviceId !== "string" || !/^[a-z0-9]{8,40}$/i.test(b.deviceId)) return { error: "Bad device id" };
  if (b.visited !== true) return { error: "Only visitors who have been to the city can rate it" };
  if (typeof b.city !== "string" || !cities.includes(b.city) || findBlocked(b.city).length) return { error: "Unknown city" };
  if (!isLabel(b.label)) return { error: "Bad label" };
  // Cut by characters (not UTF-16 units, which can split an emoji) and drop NUL, which Postgres rejects.
  const comment = typeof b.comment === "string" ? Array.from(b.comment.replace(/\u0000/g, "").trim()).slice(0, MAX_COMMENT).join("").trim() : "";
  return { deviceId: b.deviceId, city: b.city, label: b.label, comment: comment || null };
}

/** The travel cities, or a 503 response when the search index has not been built. */
export function citiesOr503(): string[] | Response {
  try {
    return travelCities();
  } catch (e) {
    console.error("[ratings] travel cities", e);
    return new Response("Ratings are unavailable: the search index is missing. Run npm run ingest.", { status: 503 });
  }
}
