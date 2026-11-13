import { citiesOr503, validateRating, type RatingInput } from "@/lib/ratings/cities";
import { ratingStore } from "@/lib/ratings/store";
import { LIMITS, clientIp, limit, readJson, tooMany } from "@/lib/limits";

export const runtime = "nodejs";

// A visitor's feeling about a city they have been to. Saved privately; the team decides the city's label.
export async function POST(req: Request) {
  const rl = limit(`rating:${clientIp(req)}`, { hour: LIMITS.ratingsPerHour });
  if (!rl.ok) return tooMany(rl.retryAfter);
  const read = await readJson<RatingInput | null>(req, LIMITS.body.rating);
  if (!read.ok) return read.res;
  const body = read.value;
  const cities = citiesOr503();
  if (cities instanceof Response) return cities;
  const v = validateRating(body, cities);
  if ("error" in v) return new Response(v.error, { status: 400 });
  try {
    await ratingStore().addRating({ device_id: v.deviceId, city: v.city, label: v.label, visited: true, comment: v.comment, created_at: new Date().toISOString() });
  } catch (e) {
    console.error("[place-rating]", e);
    return new Response("Could not save rating", { status: 502 });
  }
  return Response.json({ ok: true });
}
