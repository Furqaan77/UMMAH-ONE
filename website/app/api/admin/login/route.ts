import { ADMIN_COOKIE, adminToken, checkPassword, deny } from "@/lib/ratings/admin-auth";
import { LIMITS, clientIp, limit, readJson, release, tooMany } from "@/lib/limits";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // At most 5 failed attempts per 15 minutes from one IP (sliding window). Each attempt reserves a slot
  // at once, before any await, so attempts sent at the same moment are counted too; a success gives it back.
  const key = `login:${clientIp(req)}`;
  const w = { fails: LIMITS.adminFailedLogins };
  const gate = limit(key, w);
  if (!gate.ok) return tooMany(gate.retryAfter);
  const read = await readJson<{ password?: unknown } | null>(req, LIMITS.body.admin);
  if (!read.ok) return read.res; // counts as a failed attempt
  const { password } = (read.value ?? {}) as { password?: unknown };
  const c = checkPassword(password);
  if (c !== "denied") release(key, w); // success, or admin off: not a guess
  if (c !== "ok") return deny(c);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${ADMIN_COOKIE}=${adminToken(process.env.ADMIN_PASSWORD!)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`,
    },
  });
}

// Log out.
export async function DELETE() {
  return new Response(null, { status: 204, headers: { "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` } });
}
