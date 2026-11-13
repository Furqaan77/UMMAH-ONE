"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { LABELS, LABEL_NAMES, type EnjoymentLabel } from "@/lib/ratings/labels";

type City = {
  city: string;
  counts: Record<EnjoymentLabel, number>;
  total: number;
  comments: { label: EnjoymentLabel; comment: string; created_at: string }[];
  label: EnjoymentLabel | null;
};

const N = LABEL_NAMES.en;

// Team only. Visitor inputs per city; Furqaan sets or clears each city's label. Nothing here is public.
export default function Admin() {
  const [state, setState] = useState<"loading" | "login" | "off" | "ready" | "error">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "rated" | "labelled">("all");

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/summary", { cache: "no-store" });
      if (res.status === 401) return setState("login");
      if (res.status === 503) {
        const msg = await res.text();
        if (msg.startsWith("Admin is off")) return setState("off");
        setError(msg);
        return setState("error");
      }
      if (!res.ok) {
        setError(`Could not load ratings (${res.status}): ${await res.text()}`);
        return setState("error");
      }
      setCities(((await res.json()) as { cities: City[] }).cities);
      setState("ready");
    } catch {
      setError("Network error: could not reach the server.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

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
    if (res.status === 429) {
      const s = Number(res.headers.get("retry-after"));
      const mins = Math.ceil((Number.isFinite(s) && s > 0 ? s : 900) / 60);
      return setError(`Too many wrong passwords. Try again in about ${mins} minute${mins > 1 ? "s" : ""}.`);
    }
    if (!res.ok) return setError("Wrong password");
    setPassword("");
    await loadSummary();
  }

  async function setLabel(city: string, label: EnjoymentLabel | null) {
    setError("");
    let res: Response;
    try {
      res = await fetch("/api/admin/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city, label }) });
    } catch {
      return setError(`Network error: ${city} was not saved.`);
    }
    if (res.status === 401) return setState("login");
    if (!res.ok) return setError(`Could not save ${city}`);
    setCities((cs) => cs.map((c) => (c.city === city ? { ...c, label } : c)));
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => undefined);
    setState("login");
  }

  if (state === "loading") return <main className="admin"><p>Loading…</p></main>;
  if (state === "error")
    return (
      <main className="admin">
        <h1>City ratings</h1>
        <p className="admin-error">{error}</p>
        <button className="chip" onClick={() => { setError(""); setState("loading"); void loadSummary(); }}>Try again</button>
      </main>
    );
  if (state === "off")
    return (
      <main className="admin">
        <h1>City ratings</h1>
        <p>Admin is off. Add <code>ADMIN_PASSWORD=…</code> (at least 12 characters) to <code>website/.env.local</code> and restart the server.</p>
      </main>
    );
  if (state === "login")
    return (
      <main className="admin">
        <h1>City ratings</h1>
        <form onSubmit={login} className="admin-login">
          <label htmlFor="admin-pw" className="sr-only">Admin password</label>
          <input id="admin-pw" type="password" autoComplete="current-password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="chip on">Log in</button>
        </form>
        {error && <p className="admin-error">{error}</p>}
      </main>
    );

  const shown = cities.filter((c) => (filter === "rated" ? c.total > 0 : filter === "labelled" ? !!c.label : true));
  const totalInputs = cities.reduce((s, c) => s + c.total, 0);

  return (
    <main className="admin">
      <div className="admin-head">
        <h1>City ratings</h1>
        <button className="link-btn" onClick={logout}>Log out</button>
      </div>
      <p className="admin-note">
        {totalInputs} visitor inputs · {cities.filter((c) => c.label).length} of {cities.length} cities labelled. Visitor inputs are private. Only the label you set is shown in the chat.
      </p>
      <div className="place-labels">
        {(["all", "rated", "labelled"] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All cities" : f === "rated" ? "With inputs" : "Labelled"}
          </button>
        ))}
      </div>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>City</th>
              {LABELS.map((l) => <th key={l}>{N[l]}</th>)}
              <th>Total</th>
              <th>Label (shown in chat)</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <Fragment key={c.city}>
                <tr>
                  <td>
                    <strong>{c.city}</strong>
                    {c.comments.length > 0 && (
                      <button className="link-btn small" onClick={() => setOpen(open === c.city ? null : c.city)}>
                        {open === c.city ? "Hide" : `${c.comments.length} comment${c.comments.length > 1 ? "s" : ""}`}
                      </button>
                    )}
                  </td>
                  {LABELS.map((l) => <td key={l} className="num">{c.counts[l] || ""}</td>)}
                  <td className="num">{c.total || ""}</td>
                  <td>
                    <div className="place-labels">
                      {LABELS.map((l) => (
                        <button key={l} aria-pressed={c.label === l} className={`chip sm ${c.label === l ? "on" : ""}`} onClick={() => setLabel(c.city, l)}>{N[l]}</button>
                      ))}
                      {c.label && <button className="link-btn small" onClick={() => setLabel(c.city, null)}>Clear</button>}
                    </div>
                  </td>
                </tr>
                {open === c.city && (
                  <tr>
                    <td colSpan={LABELS.length + 3}>
                      <ul className="admin-comments">
                        {c.comments.map((x, i) => (
                          <li key={i} dir="auto"><em>{N[x.label]}</em> · {new Date(x.created_at).toLocaleDateString()} · {x.comment}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
