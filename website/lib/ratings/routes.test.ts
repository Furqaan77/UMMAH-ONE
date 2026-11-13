import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DEFAULT_INDEX_PATH } from "../rag/store";
import { ADMIN_COOKIE, adminToken } from "./admin-auth";

// Route-level checks. The paths tested here return before any write, so nothing is saved to .data/.
// The chat model is pointed at a closed port: the "place" event is sent before the model is called.
process.env.OLLAMA_URL = "http://127.0.0.1:9";
const PW = "route-test-password-123";
const hasIndex = existsSync(DEFAULT_INDEX_PATH);
const post = (body: unknown, cookie?: string) =>
  new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

test("place-rating route: 400 for not visited, unknown city, bad label, null body", { skip: !hasIndex && "run npm run ingest first" }, async () => {
  const { POST } = await import("../../app/api/place-rating/route");
  const base = { deviceId: "routetest0001", city: "Konya", label: "enjoyable", visited: true };
  assert.equal((await POST(post({ ...base, visited: false }))).status, 400);
  assert.equal((await POST(post({ ...base, city: "Paris" }))).status, 400);
  assert.equal((await POST(post({ ...base, label: "great" }))).status, 400);
  assert.equal((await POST(post(null))).status, 400);
});

test("admin routes: 503 without a password, 401 without a valid cookie, login cookie accepted", async () => {
  const label = await import("../../app/api/admin/label/route");
  const summary = await import("../../app/api/admin/summary/route");
  const login = await import("../../app/api/admin/login/route");
  process.env.ADMIN_PASSWORD = "";
  assert.equal((await summary.GET(new Request("http://x"))).status, 503);
  assert.equal((await label.POST(post({ city: "Konya", label: "boring" }))).status, 503);
  process.env.ADMIN_PASSWORD = PW;
  assert.equal((await summary.GET(new Request("http://x"))).status, 401);
  assert.equal((await label.POST(post({ city: "Konya", label: "boring" }))).status, 401);
  assert.equal((await label.POST(post({ city: "Konya", label: "boring" }, `${ADMIN_COOKIE}=${adminToken("wrong-password-xyz")}`))).status, 401);
  assert.equal((await login.POST(post({ password: "nope" }))).status, 401);
  assert.equal((await login.POST(post(null))).status, 401);
  const res = await login.POST(post({ password: PW }));
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie")!.split(";")[0];
  assert.match(res.headers.get("set-cookie")!, /HttpOnly/);
  // A valid cookie gets past the gate: an unknown city is then a 400, not a 401.
  if (hasIndex) assert.equal((await label.POST(post({ city: "Paris", label: "boring" }, cookie))).status, 400);
  process.env.ADMIN_PASSWORD = "";
});

async function events(res: Response) {
  return (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as { type: string; city?: string; label?: string | null });
}

test("chat route: place event only for one travel city", { skip: !hasIndex && "run npm run ingest first" }, async () => {
  const { POST } = await import("../../app/api/chat/route");
  const ask = (q: string) => POST(post({ messages: [{ role: "user", content: q }], lang: "en" }));
  const one = (await events(await ask("Tell me about Konya"))).filter((e) => e.type === "place");
  assert.equal(one.length, 1);
  assert.equal(one[0].city, "Konya");
  assert.equal((await events(await ask("Compare Bodrum and Fethiye"))).filter((e) => e.type === "place").length, 0);
  assert.equal((await events(await ask("Which places are most enjoyable?"))).filter((e) => e.type === "place").length, 0);
});
