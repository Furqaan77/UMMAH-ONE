// Team only: review tester answers from /check, and save Mr Tanveer's approve/reject decisions.
// Decisions go to .data/guide-check-decisions.jsonl. This never changes the chatbot data.
import { checkCookie, deny } from "@/lib/ratings/admin-auth";
import { readJson } from "@/lib/limits";
import { MAX_DECISION_TEXT, appendDecision, knownKeys, loadReview } from "@/lib/guide-check/review";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const c = checkCookie(req.headers.get("cookie"));
  if (c !== "ok") return deny(c);
  try {
    return Response.json({ cities: await loadReview() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/guide-check]", e);
    return new Response("Could not read the answers", { status: 502 });
  }
}

export async function POST(req: Request) {
  const c = checkCookie(req.headers.get("cookie"));
  if (c !== "ok") return deny(c);
  const read = await readJson<Record<string, unknown> | null>(req, 16 * 1024);
  if (!read.ok) return read.res;
  const { key, decision, text } = (read.value ?? {}) as Record<string, unknown>;
  if (decision !== "approved" && decision !== "rejected") return new Response("Bad decision", { status: 400 });
  if (text != null && typeof text !== "string") return new Response("Bad text", { status: 400 });
  const clean = typeof text === "string" ? text.replace(/\u0000/g, "").trim() : "";
  if (Array.from(clean).length > MAX_DECISION_TEXT) return new Response("Text too long", { status: 400 });
  try {
    if (typeof key !== "string" || !knownKeys(await loadReview()).has(key)) return new Response("Unknown item", { status: 400 });
    const row = { at: new Date().toISOString(), key, decision, text: clean || null } as const;
    await appendDecision(row);
    return Response.json({ ok: true, decision: row });
  } catch (e) {
    console.error("[admin/guide-check]", e);
    return new Response("Could not save the decision", { status: 502 });
  }
}
