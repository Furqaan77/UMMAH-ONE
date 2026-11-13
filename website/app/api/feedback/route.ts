import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { LIMITS, clientIp, limit, readJson, tooMany } from "@/lib/limits";

export const runtime = "nodejs";

type Feedback = {
  chatId: string;
  messageId: string;
  rating: "up" | "down";
  comment?: string;
  question?: string;
  answer?: string;
};

// Saves feedback to Supabase when it is configured; otherwise to website/.data/feedback.jsonl for the team.
export async function POST(req: Request) {
  const rl = limit(`feedback:${clientIp(req)}`, { hour: LIMITS.feedbackPerHour });
  if (!rl.ok) return tooMany(rl.retryAfter);
  const read = await readJson<Feedback | null>(req, LIMITS.body.feedback);
  if (!read.ok) return read.res;
  const fb = (read.value ?? {}) as Feedback;
  if (!fb.messageId || (fb.rating !== "up" && fb.rating !== "down")) return new Response("Bad request", { status: 400 });

  const row = {
    chat_id: fb.chatId,
    message_id: fb.messageId,
    rating: fb.rating,
    comment: fb.comment?.slice(0, 2000) ?? null,
    question: fb.question?.slice(0, 4000) ?? null,
    answer: fb.answer?.slice(0, 8000) ?? null,
    created_at: new Date().toISOString(),
  };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const res = await fetch(`${url}/rest/v1/feedback`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!res.ok) return new Response("Could not save feedback", { status: 502 });
  } else {
    const dir = path.join(process.cwd(), ".data");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "feedback.jsonl"), JSON.stringify(row) + "\n");
  }
  return Response.json({ ok: true });
}
