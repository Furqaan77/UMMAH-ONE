import { ADMIN_COOKIE, adminToken, checkPassword, deny } from "@/lib/ratings/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { password } = ((await req.json().catch(() => null)) ?? {}) as { password?: unknown };
  const c = checkPassword(password);
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
