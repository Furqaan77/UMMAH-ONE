"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CHECK_T } from "@/lib/guide-check/strings";
import { LABEL_NAMES, type EnjoymentLabel } from "@/lib/ratings/labels";
import type { CityReview, Decision, DecisionRow, Kind, NotePart } from "@/lib/guide-check/review";

const T = CHECK_T.en;
const KIND_NAME: Record<Kind, string> = { thing: "Things to do", buy: "What to buy", ease: "Ease of visit" };
const MARKS: Record<Kind, Record<string, string>> = { thing: T.thing, buy: T.buy, ease: T.ease };
const PART_NAME: Record<NotePart, string> = {
  thingsMissing: "Things to do: missing",
  buyMissing: "What to buy: missing",
  halalNote: "Halal food",
  easeMissing: "Ease of visit: missing",
  more: "Anything else",
};
type Filter = "all" | "open" | "approved" | "rejected";
type Row = { key: string; decision: DecisionRow | null; newCounts?: Record<string, number> };
/** No decision yet, or new answers came in after the decision. */
const needsDecision = (r: Row) => !r.decision || Object.keys(r.newCounts ?? {}).length > 0;
const pass = (f: Filter, r: Row) => (f === "all" ? true : f === "open" ? needsDecision(r) : r.decision?.decision === f);
const date = (s: string) => new Date(s).toLocaleDateString();

// Team only (Mr Tanveer). Approve or reject what testers said. Approved items wait for Bushra to publish;
// nothing on this page changes the chatbot.
export default function GuideReview() {
  const [state, setState] = useState<"loading" | "login" | "off" | "ready" | "error">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cities, setCities] = useState<CityReview[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [texts, setTexts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/guide-check", { cache: "no-store" });
      if (res.status === 401) return setState("login");
      if (res.status === 503) return setState("off");
      if (!res.ok) {
        setError(`Could not load the answers (${res.status}): ${await res.text()}`);
        return setState("error");
      }
      setCities(((await res.json()) as { cities: CityReview[] }).cities);
      setState("ready");
    } catch {
      setError("Network error: could not reach the server.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    let res: Response;
    try {
      res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    } catch {
      return setError("Network error: could not reach the server.");
    }
    if (res.status === 503) return setState("off");
    if (res.status === 429) return setError("Too many wrong passwords. Try again in about 15 minutes.");
    if (!res.ok) return setError("Wrong password");
    setPassword("");
    await load();
  }

  async function decide(key: string, decision: Decision, fallbackText: string | null) {
    setError("");
    const text = texts[key] ?? fallbackText ?? "";
    let res: Response;
    try {
      res = await fetch("/api/admin/guide-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, decision, text }) });
    } catch {
      return setError("Network error: the decision was not saved.");
    }
    if (res.status === 401) return setState("login");
    if (!res.ok) return setError(`Could not save the decision: ${await res.text()}`);
    const saved = ((await res.json()) as { decision: DecisionRow }).decision;
    const set = <T extends Row>(r: T): T => (r.key === key ? { ...r, decision: saved, ...(r.newCounts ? { newCounts: {} } : {}) } : r);
    setCities((cs) => cs.map((c) => ({ ...c, items: c.items.map(set), notes: c.notes.map(set) })));
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => undefined);
    setState("login");
  }

  if (state === "loading") return <main className="admin"><p>Loading…</p></main>;
  if (state === "off")
    return (
      <main className="admin">
        <h1>Guide check review</h1>
        <p>Admin is off. Add <code>ADMIN_PASSWORD=…</code> (at least 12 characters) to <code>website/.env.local</code> and restart the server.</p>
      </main>
    );
  if (state === "error")
    return (
      <main className="admin">
        <h1>Guide check review</h1>
        <p className="admin-error">{error}</p>
        <button className="chip" onClick={() => { setError(""); setState("loading"); void load(); }}>Try again</button>
      </main>
    );
  if (state === "login")
    return (
      <main className="admin">
        <h1>Guide check review</h1>
        <form onSubmit={login} className="admin-login">
          <label htmlFor="admin-pw" className="sr-only">Admin password</label>
          <input id="admin-pw" type="password" autoComplete="current-password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="chip on">Log in</button>
        </form>
        {error && <p className="admin-error">{error}</p>}
      </main>
    );

  const all = cities.flatMap((c) => [
    ...c.items.map((i) => ({ city: c.city, label: `${KIND_NAME[i.kind]}: ${i.item}`, key: i.key, decision: i.decision, newCounts: i.newCounts })),
    ...c.notes.map((n) => ({ city: c.city, label: `${PART_NAME[n.part]}: ${n.text}`, key: n.key, decision: n.decision })),
  ]);
  const approved = all.filter((r) => r.decision?.decision === "approved");
  const open = all.filter(needsDecision).length;
  const answers = cities.reduce((s, c) => s + c.answers, 0);

  const actions = (r: Row) => (
    <div className="rv-actions">
      <textarea
        dir="auto"
        rows={2}
        maxLength={2000}
        placeholder="What should the guide say? (optional)"
        value={texts[r.key] ?? r.decision?.text ?? ""}
        onChange={(e) => setTexts((t) => ({ ...t, [r.key]: e.target.value }))}
      />
      <div className="place-labels">
        <button className={`chip sm ${r.decision?.decision === "approved" ? "on" : ""}`} aria-pressed={r.decision?.decision === "approved"} onClick={() => decide(r.key, "approved", r.decision?.text ?? null)}>Approve</button>
        <button className={`chip sm ${r.decision?.decision === "rejected" ? "on" : ""}`} aria-pressed={r.decision?.decision === "rejected"} onClick={() => decide(r.key, "rejected", r.decision?.text ?? null)}>Reject</button>
        {r.decision && <span className="rv-when">{r.decision.decision === "approved" ? "Approved" : "Rejected"} {date(r.decision.at)}</span>}
      </div>
    </div>
  );

  return (
    <main className="admin">
      <div className="admin-head">
        <h1>Guide check review</h1>
        <div className="place-labels">
          <Link className="link-btn" href="/admin">City ratings</Link>
          <button className="link-btn" onClick={logout}>Log out</button>
        </div>
      </div>
      <p className="admin-note">
        {answers} tester answers · {cities.length} {cities.length === 1 ? "city" : "cities"} · {open} {open === 1 ? "item needs" : "items need"} a decision. Nothing here changes the chatbot. Approved items wait for Bushra to check and publish.
      </p>
      {error && <p className="admin-error">{error}</p>}

      <section className="rv-publish">
        <h2>Waiting to publish ({approved.length})</h2>
        {approved.length === 0 ? (
          <p className="admin-note">Nothing approved yet.</p>
        ) : (
          <ul className="admin-comments">
            {approved.map((r) => (
              <li key={r.key} dir="auto"><strong>{r.city}</strong> · {r.label}{r.decision?.text && <> → <em>{r.decision.text}</em></>}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="place-labels">
        {(["open", "all", "approved", "rejected"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
            {f === "open" ? "Needs decision" : f === "all" ? "All" : f === "approved" ? "Approved" : "Rejected"}
          </button>
        ))}
      </div>

      {cities.length === 0 && <p className="admin-note">No answers yet.</p>}
      {cities.map((c) => {
        const items = c.items.filter((i) => pass(filter, i));
        const notes = c.notes.filter((n) => pass(filter, n));
        if (!items.length && !notes.length && filter !== "all") return null;
        return (
          <section key={c.city} className="rv-city">
            <h2>{c.city}{c.country && `, ${c.country}`} <span className="rv-count">{c.answers} answer{c.answers > 1 ? "s" : ""}</span></h2>
            <p className="admin-note">
              Halal food: {Object.entries(c.halal).map(([k, n]) => `${T.halal[k as keyof typeof T.halal] ?? k} ${n}`).join(", ") || "no answers"}
              {" · "}How it felt: {Object.entries(c.feel).map(([k, n]) => `${LABEL_NAMES.en[k as EnjoymentLabel] ?? k} ${n}`).join(", ") || "no answers"}
            </p>
            {items.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Item</th><th>Testers said</th><th>Decision</th></tr></thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.key}>
                        <td><span className="rv-kind">{KIND_NAME[i.kind]}</span>{i.item}</td>
                        <td>{Object.entries(i.counts).map(([m, n]) => <div key={m}>{MARKS[i.kind][m] ?? m}: <strong className="rv-n">{n}</strong></div>)}
                          {i.decision && Object.keys(i.newCounts).length > 0 && (
                            <div className="rv-new">
                              New since the decision: {Object.entries(i.newCounts).map(([m, n]) => `${MARKS[i.kind][m] ?? m} ${n}`).join(", ")}
                            </div>
                          )}
                        </td>
                        <td>{actions(i)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {notes.length > 0 && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Written by a tester</th><th>Decision</th></tr></thead>
                  <tbody>
                    {notes.map((n) => (
                      <tr key={n.key}>
                        <td dir="auto">
                          <span className="rv-kind">{PART_NAME[n.part]} · {date(n.at)}{n.visit && ` · visited ${n.visit}`}{n.lang === "ar" && " · Arabic"}</span>
                          <span className="rv-text">{n.text}</span>
                        </td>
                        <td>{actions(n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
