import { checkCookie, deny } from "@/lib/ratings/admin-auth";
import { citiesOr503 } from "@/lib/ratings/cities";
import { ratingStore, summarize } from "@/lib/ratings/store";

export const runtime = "nodejs";

// Team only: every travel city with its visitor counts, comments and current label.
export async function GET(req: Request) {
  const c = checkCookie(req.headers.get("cookie"));
  if (c !== "ok") return deny(c);
  const travel = citiesOr503();
  if (travel instanceof Response) return travel;
  try {
    const store = ratingStore();
    const [ratings, labels] = await Promise.all([store.listRatings(), store.getLabels()]);
    const cities = summarize(ratings, travel).map((s) => ({ ...s, label: labels[s.city] ?? null }));
    return Response.json({ cities }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/summary]", e);
    return new Response("Could not load ratings from storage", { status: 502 });
  }
}
