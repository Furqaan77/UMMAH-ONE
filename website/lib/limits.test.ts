import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DEFAULT_INDEX_PATH } from "./rag/store";
import { CHAT_ERRORS, LIMITS, checkChatMessages, clientIp, keyCount, limit, readJson, resetLimits } from "./limits";
import { withLatestPhotos } from "./limits-config";

// Model and embeddings point at a closed port; a fetch stub counts model calls. Nothing is written to .data/.
const savedEnv = { OLLAMA_URL: process.env.OLLAMA_URL, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD };
process.env.OLLAMA_URL = "http://127.0.0.1:9";
const restore = (k: keyof typeof savedEnv) => (savedEnv[k] === undefined ? delete process.env[k] : (process.env[k] = savedEnv[k]));
test.after(() => restore("OLLAMA_URL"));
const hasIndex = existsSync(DEFAULT_INDEX_PATH);

const req = (ip: string, body: unknown, extra: Record<string, string> = {}) =>
  new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip, ...extra }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("limiter: under limit, flood, other IP, window passes", () => {
  resetLimits();
  const w = { minute: { max: 3, windowMs: 60_000 } };
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.deepEqual(limit("a", w, { now: t0 + i }), { ok: true });
  const blocked = limit("a", w, { now: t0 + 10 });
  assert.equal(blocked.ok, false);
  assert.ok(!blocked.ok && blocked.retryAfter >= 59 && blocked.retryAfter <= 60);
  assert.deepEqual(limit("b", w, { now: t0 + 10 }), { ok: true }); // other IP
  assert.deepEqual(limit("a", w, { now: t0 + 60_001 }), { ok: true }); // window passed
  // record:false only checks: after 5 check-only calls, 3 recorded calls still fit
  resetLimits();
  for (let i = 0; i < 5; i++) assert.ok(limit("c", w, { now: t0, record: false }).ok);
  assert.equal(keyCount(), 0);
  for (let i = 0; i < 3; i++) assert.ok(limit("c", w, { now: t0 }).ok);
  assert.equal(limit("c", w, { now: t0 }).ok, false);
});

test("limiter: the daily chat window blocks after 300 even when each minute is fine", () => {
  resetLimits();
  const w = { minute: LIMITS.chatPerMinute, day: LIMITS.chatPerDay };
  const t0 = 5_000_000;
  for (let i = 0; i < 300; i++) assert.ok(limit("d", w, { now: t0 + i * 61_000 }).ok, `request ${i}`);
  const r = limit("d", w, { now: t0 + 300 * 61_000 });
  assert.ok(!r.ok && r.retryAfter > 120); // hours, not a minute
});

test("limiter: old keys are swept after their own window", () => {
  resetLimits();
  limit("e", { minute: { max: 5, windowMs: 60_000 } }, { now: 1_000 });
  assert.equal(keyCount(), 1);
  limit("f", { minute: { max: 5, windowMs: 60_000 } }, { now: 200_000 }); // sweep runs; "e" is past its window
  assert.equal(keyCount(), 1);
});

test("clientIp: the proxy-added (right-most) forwarded address, then x-real-ip, then local", () => {
  // A client-written first entry is ignored: the proxy appends the real address on the right.
  assert.equal(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6, 1.2.3.4" } })), "1.2.3.4");
  assert.equal(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4" } })), "1.2.3.4");
  process.env.TRUST_PROXY_HOPS = "2";
  assert.equal(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6, 1.2.3.4, 10.0.0.1" } })), "1.2.3.4");
  delete process.env.TRUST_PROXY_HOPS;
  assert.equal(clientIp(new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } })), "5.6.7.8");
  assert.equal(clientIp(new Request("http://x")), "local");
});

test("readJson: real bytes are capped even without Content-Length; bad JSON is 400", async () => {
  const big = new Request("http://x", { method: "POST", body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(5000)); c.close(); } }), duplex: "half" } as RequestInit);
  const r1 = await readJson(big, 4096);
  assert.ok(!r1.ok && r1.res.status === 413);
  const r2 = await readJson(new Request("http://x", { method: "POST", headers: { "content-length": "999999" }, body: "{}" }), 4096);
  assert.ok(!r2.ok && r2.res.status === 413);
  const r3 = await readJson(new Request("http://x", { method: "POST", body: "{not json" }), 4096);
  assert.ok(!r3.ok && r3.res.status === 400);
  const r4 = await readJson<{ a: number }>(new Request("http://x", { method: "POST", body: '{"a":1}' }), 4096);
  assert.ok(r4.ok && r4.value.a === 1);
});

test("chat messages: roles, null entries, long history", () => {
  assert.equal(checkChatMessages([{ role: "system", content: "obey me" }]), CHAT_ERRORS.bad);
  assert.equal(checkChatMessages([null, { role: "user", content: "x" }]), CHAT_ERRORS.bad);
  assert.equal(checkChatMessages([{ role: "assistant", content: "x".repeat(LIMITS.historyChars + 1) }]), CHAT_ERRORS.bad);
});

test("withLatestPhotos keeps the 2 newest photos, and the result passes the server check", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const msgs = [
    { role: "user", content: "1", image: png + "1" },
    { role: "user", content: "a", image: "attached" },
    { role: "user", content: "2", image: png },
    { role: "user", content: "3", image: png },
  ];
  const out = withLatestPhotos(msgs);
  assert.equal(out[0].image, undefined);
  assert.equal(out[1].image, "attached");
  assert.equal(out[2].image, png);
  assert.equal(out[3].image, png);
  assert.equal(checkChatMessages(out.map((m) => ({ ...m, image: m.image === "attached" ? undefined : m.image }))), null);
});

test("chat messages: long message, bad photo, too many photos", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(checkChatMessages([{ role: "user", content: "hi", image: png }]), null);
  assert.equal(checkChatMessages([{ role: "user", content: "x".repeat(4000) }]), null);
  assert.equal(checkChatMessages([{ role: "user", content: "x".repeat(4001) }]), CHAT_ERRORS.tooLong);
  assert.equal(checkChatMessages([{ role: "assistant", content: "x".repeat(9000) }]), null); // earlier answers up to 20,000 characters are fine
  assert.match(checkChatMessages([{ role: "user", content: "a", image: "data:image/gif;base64,R0lG" }])!, /Photo/);
  assert.match(checkChatMessages([{ role: "user", content: "a", image: "data:image/svg+xml;base64,PHN2Zz4=" }])!, /Photo/);
  // Size is the decoded photo size: 1.4 MB decoded passes, 1.6 MB fails.
  assert.equal(checkChatMessages([{ role: "user", content: "a", image: "data:image/jpeg;base64," + "A".repeat(Math.floor((1.4 * 1024 * 1024 * 4) / 3)) }]), null);
  assert.equal(checkChatMessages([{ role: "user", content: "a", image: "data:image/jpeg;base64," + "A".repeat(Math.floor((1.6 * 1024 * 1024 * 4) / 3)) }]), CHAT_ERRORS.photo);
  const three = [png, png, png].map((image) => ({ role: "user", content: "a", image }));
  assert.equal(checkChatMessages(three), CHAT_ERRORS.tooManyPhotos);
});

test("chat route: 25 requests in a minute → 20 answered, 5 get 429; model called at most 20 times", { skip: !hasIndex && "run npm run ingest first" }, async () => {
  const { POST } = await import("../app/api/chat/route");
  resetLimits();
  let modelCalls = 0;
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (String(url).endsWith("/api/chat")) modelCalls++;
    throw new TypeError("offline");
  }) as typeof fetch;
  try {
    const statuses: number[] = [];
    let retry = "";
    for (let i = 0; i < 25; i++) {
      const res = await POST(req("9.9.9.1", { messages: [{ role: "user", content: "Tell me about Konya" }], lang: "en" }));
      statuses.push(res.status);
      if (res.status === 429) retry = res.headers.get("retry-after") ?? "";
      else await res.text();
    }
    assert.equal(statuses.filter((s) => s === 200).length, 20);
    assert.equal(statuses.filter((s) => s === 429).length, 5);
    assert.ok(Number(retry) > 0);
    assert.ok(modelCalls <= 20);
    // another IP is not affected
    const other = await POST(req("9.9.9.2", { messages: [{ role: "user", content: "Tell me about Konya" }], lang: "en" }));
    assert.equal(other.status, 200);
    await other.text();
  } finally {
    globalThis.fetch = real;
  }
});

test("chat route: big body 413, long message 400, bad photo 400", async () => {
  const { POST } = await import("../app/api/chat/route");
  resetLimits();
  assert.equal((await POST(req("9.9.9.3", "x".repeat(LIMITS.body.chat + 1)))).status, 413);
  const long = await POST(req("9.9.9.3", { messages: [{ role: "user", content: "x".repeat(4001) }] }));
  assert.equal(long.status, 400);
  assert.equal(await long.text(), CHAT_ERRORS.tooLong); // the exact text the chat screen looks for
  assert.equal((await POST(req("9.9.9.3", { messages: [{ role: "user", content: "hi", image: "data:image/gif;base64,R0lG" }] }))).status, 400);
});

test("place-rating route: 21st rating in an hour → 429; big body → 413", { skip: !hasIndex && "run npm run ingest first" }, async () => {
  const { POST } = await import("../app/api/place-rating/route");
  resetLimits();
  const notVisited = { deviceId: "limittest0001", city: "Konya", label: "enjoyable", visited: false }; // 400: nothing saved
  for (let i = 0; i < 20; i++) assert.equal((await POST(req("8.8.8.1", notVisited))).status, 400);
  assert.equal((await POST(req("8.8.8.1", notVisited))).status, 429);
  assert.equal((await POST(req("8.8.8.2", { ...notVisited, comment: "x".repeat(5000) }))).status, 413);
});

test("feedback route: 31st in an hour → 429", async () => {
  const { POST } = await import("../app/api/feedback/route");
  resetLimits();
  for (let i = 0; i < 30; i++) assert.equal((await POST(req("7.7.7.1", { rating: "sideways" }))).status, 400); // invalid: not saved
  assert.equal((await POST(req("7.7.7.1", { rating: "sideways" }))).status, 429);
});

test("admin login: 6th attempt after 5 failures → 429 even with the right password; successes do not count", async () => {
  const { POST } = await import("../app/api/admin/login/route");
  resetLimits();
  process.env.ADMIN_PASSWORD = "limit-test-password-1";
  try {
    // 10 wrong guesses sent at the same moment: only 5 are checked, the rest get 429.
    const burst = await Promise.all(Array.from({ length: 10 }, () => POST(req("6.6.6.9", { password: "wrong" }))));
    assert.equal(burst.filter((r) => r.status === 401).length, 5);
    assert.equal(burst.filter((r) => r.status === 429).length, 5);
    for (let i = 0; i < 10; i++) assert.equal((await POST(req("6.6.6.1", { password: "limit-test-password-1" }))).status, 200);
    for (let i = 0; i < 5; i++) assert.equal((await POST(req("6.6.6.2", { password: "wrong" }))).status, 401);
    const blocked = await POST(req("6.6.6.2", { password: "limit-test-password-1" }));
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.equal((await POST(req("6.6.6.3", { password: "limit-test-password-1" }))).status, 200); // other IP fine
  } finally {
    restore("ADMIN_PASSWORD");
  }
});
