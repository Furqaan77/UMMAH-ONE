// Rate limits and size limits for the website APIs (hosting step 1, 13 Nov 2026).
// Numbers live in limits-config.ts. Counters are in memory, per server process —
// fine for one server; move them to Supabase or Redis when hosting is chosen.
import { CHAT_ERRORS, LIMITS } from "./limits-config";

export { CHAT_ERRORS, LIMITS };

type Window = { max: number; windowMs: number };

/**
 * The caller's IP. A client can write its own x-forwarded-for, and proxies add the real address on the RIGHT,
 * so the entry TRUST_PROXY_HOPS from the right is used (default 1 = one proxy in front, e.g. the host).
 * Then x-real-ip, then "local" (no proxy: everyone shares one bucket — only acceptable on this Mac).
 */
export function clientIp(req: Request): string {
  const hops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS) || 1);
  const list = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list[Math.max(0, list.length - hops)] || req.headers.get("x-real-ip")?.trim() || "local";
}

const MAX_KEYS = 100_000;
const hits = new Map<string, { ts: number[]; windowMs: number }>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  // Drop keys with no hit inside their own window.
  for (const [k, v] of hits) if (!v.ts.length || now - v.ts[v.ts.length - 1] >= v.windowMs) hits.delete(k);
}

function recent(key: string, w: Window, now: number): number[] {
  const v = hits.get(key);
  if (!v) return [];
  v.ts = v.ts.filter((t) => now - t < w.windowMs);
  return v.ts;
}

function record(key: string, w: Window, now: number) {
  const v = hits.get(key);
  if (v) v.ts.push(now);
  else {
    if (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value!); // oldest key first
    hits.set(key, { ts: [now], windowMs: w.windowMs });
  }
}

export type LimitResult = { ok: true } | { ok: false; retryAfter: number };

/** Checks every window for this key; records one hit in each only when all allow it (record=false only checks). Synchronous. */
export function limit(key: string, windows: Record<string, Window>, opts: { now?: number; record?: boolean } = {}): LimitResult {
  const now = opts.now ?? Date.now();
  sweep(now);
  let retryAfter = 0;
  for (const [name, w] of Object.entries(windows)) {
    const ts = recent(`${key}:${name}`, w, now);
    if (ts.length >= w.max) retryAfter = Math.max(retryAfter, Math.ceil((ts[0] + w.windowMs - now) / 1000));
  }
  if (retryAfter > 0) return { ok: false, retryAfter: Math.max(1, retryAfter) };
  if (opts.record !== false) for (const [name, w] of Object.entries(windows)) record(`${key}:${name}`, w, now);
  return { ok: true };
}

/** Gives back one hit recorded by limit() (used when a reserved login attempt turns out to be a success). */
export function release(key: string, windows: Record<string, Window>) {
  for (const name of Object.keys(windows)) hits.get(`${key}:${name}`)?.ts.pop();
}

/** For tests. */
export function resetLimits() {
  hits.clear();
  lastSweep = 0;
}

export function keyCount() {
  return hits.size;
}

export function tooMany(retryAfter: number): Response {
  return new Response("Too many requests. Please wait and try again.", { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

/** Reads a JSON body with a byte cap (checks the real bytes, not only Content-Length). 413 when too big, 400 when not JSON. */
export async function readJson<T = unknown>(req: Request, maxBytes: number): Promise<{ ok: true; value: T } | { ok: false; res: Response }> {
  const tooBig = () => ({ ok: false as const, res: new Response("Request too large", { status: 413 }) });
  const declared = Number(req.headers.get("content-length"));
  if (declared > maxBytes) return tooBig();
  if (!req.body) return { ok: false, res: new Response("Bad request", { status: 400 }) };
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return tooBig();
    }
    parts.push(value);
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(parts).toString("utf8")) as T };
  } catch {
    return { ok: false, res: new Response("Bad request", { status: 400 }) };
  }
}

/** Decoded size of a base64 data URL. */
function photoBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
}

/** Message, role, text and photo checks for /api/chat. Returns a CHAT_ERRORS text for a 400, or null when fine. */
export function checkChatMessages(messages: unknown[]): string | null {
  let photos = 0;
  const photoRe = new RegExp(`^data:image/(${LIMITS.photo.types.join("|")});base64,[A-Za-z0-9+/=]+$`);
  for (const raw of messages) {
    if (!raw || typeof raw !== "object") return CHAT_ERRORS.bad;
    const m = raw as { role?: unknown; content?: unknown; image?: unknown };
    if (m.role !== "user" && m.role !== "assistant") return CHAT_ERRORS.bad; // never a client "system" message
    if (typeof m.content !== "string") return CHAT_ERRORS.bad;
    const chars = Array.from(m.content).length;
    if (m.role === "user" && chars > LIMITS.messageChars) return CHAT_ERRORS.tooLong;
    if (m.role === "assistant" && chars > LIMITS.historyChars) return CHAT_ERRORS.bad;
    if (m.image === undefined || m.image === null) continue;
    photos++;
    // Size first (cheap), then the pattern.
    const ok = typeof m.image === "string" && m.image.length <= LIMITS.photo.maxBytes * 1.4 && photoRe.test(m.image) && photoBytes(m.image) <= LIMITS.photo.maxBytes;
    if (!ok) return CHAT_ERRORS.photo;
  }
  if (photos > LIMITS.photo.maxPerRequest) return CHAT_ERRORS.tooManyPhotos;
  return null;
}
