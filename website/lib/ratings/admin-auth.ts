import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Admin access for Furqaan: one password in ADMIN_PASSWORD (.env.local), at least 12 characters.
// The cookie holds "<issued-at>.<HMAC>", never the password, and the server rejects it after 12 hours.
export const ADMIN_COOKIE = "uo_admin";
export const MIN_PASSWORD = 12;
export const SESSION_MS = 12 * 60 * 60 * 1000;

function sign(password: string, iat: number): string {
  return createHmac("sha256", password).update(`ummah-one-admin-v2.${iat}`).digest("hex");
}

export function adminToken(password: string, now = Date.now()): string {
  return `${now}.${sign(password, now)}`;
}

/** Constant-time compare that does not reveal the length (both sides hashed first). */
function same(a: string, b: string): boolean {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

export type AdminCheck = "ok" | "disabled" | "denied";

const off = (password: string) => password.length < MIN_PASSWORD;

export function checkPassword(given: unknown, password = process.env.ADMIN_PASSWORD ?? ""): AdminCheck {
  if (off(password)) return "disabled";
  return typeof given === "string" && same(given, password) ? "ok" : "denied";
}

export function checkCookie(header: string | null, password = process.env.ADMIN_PASSWORD ?? "", now = Date.now()): AdminCheck {
  if (off(password)) return "disabled";
  const m = (header ?? "").match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=(\\d{1,15})\\.([a-f0-9]{64})`));
  if (!m) return "denied";
  const iat = Number(m[1]);
  if (!(iat <= now && now - iat < SESSION_MS)) return "denied";
  return same(m[2], sign(password, iat)) ? "ok" : "denied";
}

/** Response for a failed check: 503 when admin is not set up, 401 otherwise. */
export function deny(c: Exclude<AdminCheck, "ok">): Response {
  return c === "disabled"
    ? new Response(`Admin is off: set ADMIN_PASSWORD (at least ${MIN_PASSWORD} characters) in .env.local`, { status: 503 })
    : new Response("Unauthorized", { status: 401 });
}
