import { checkCookie, deny } from "@/lib/ratings/admin-auth";
import { citiesOr503 } from "@/lib/ratings/cities";
import { isLabel } from "@/lib/ratings/labels";
import { ratingStore } from "@/lib/ratings/store";

export const runtime = "nodejs";

// Team only: set a city's label (or clear it with label null). This is the only way a label is set.
export async function POST(req: Request) {
  const c = checkCookie(req.headers.get("cookie"));
  if (c !== "ok") return deny(c);
  const { city, label } = ((await req.json().catch(() => null)) ?? {}) as { city?: unknown; label?: unknown };
  const cities = citiesOr503();
  if (cities instanceof Response) return cities;
  if (typeof city !== "string" || !cities.includes(city)) return new Response("Unknown city", { status: 400 });
  if (label !== null && !isLabel(label)) return new Response("Bad label", { status: 400 });
  try {
    await ratingStore().setLabel(city, label);
  } catch (e) {
    console.error("[admin/label]", e);
    return new Response("Could not save the label", { status: 502 });
  }
  return Response.json({ ok: true });
}
