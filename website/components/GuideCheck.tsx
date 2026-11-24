"use client";
// "Help check the guide": testers who visited a city mark the guide's items and add what is missing.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CityGuide } from "@/lib/guide-check/content";
import { CHECK_T } from "@/lib/guide-check/strings";
import { LABELS, LABEL_NAMES } from "@/lib/ratings/labels";

type Lang = "en" | "ar";
type Marks = (string | null)[];
/** Marks that open the "Tell us why" box. */
const DISAGREE = new Set(["wrong", "closed", "easier", "harder"]);

function Choice({ options, value, onChange, name }: { options: Record<string, string>; value: string | null; onChange: (v: string | null) => void; name: string }) {
  return (
    <div className="gc-choices" role="radiogroup" aria-label={name}>
      {Object.entries(options).map(([k, label]) => (
        <button type="button" key={k} role="radio" aria-checked={value === k} className={`chip ${value === k ? "on" : ""}`} onClick={() => onChange(value === k ? null : k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function GuideCheck({ cities }: { cities: CityGuide[] }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language?.startsWith("ar")) setLang("ar");
  }, []);
  const t = CHECK_T[lang];
  const sorted = useMemo(() => [...cities].sort((a, b) => a.city.localeCompare(b.city)), [cities]);

  const [city, setCity] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [things, setThings] = useState<Marks>([]);
  const [buy, setBuy] = useState<Marks>([]);
  const [ease, setEase] = useState<Marks>([]);
  const [halal, setHalal] = useState<string | null>(null);
  const [feel, setFeel] = useState<string | null>(null);
  const [txt, setTxt] = useState<Record<string, string>>({});
  const [why, setWhy] = useState<Record<string, string>>({}); // key: "things:3"
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");

  const g = sorted.find((c) => c.city === city);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 31 }, (_, i) => thisYear - i);

  function reset(next = "") {
    setCity(next);
    setThings([]);
    setBuy([]);
    setEase([]);
    setHalal(null);
    setFeel(null);
    setTxt({});
    setWhy({});
    setErr("");
    setState("idle");
  }

  const setAt = (_arr: Marks, set: (f: (m: Marks) => Marks) => void, i: number) => (v: string | null) =>
    set((prev) => {
      const n = [...prev];
      n[i] = v;
      return n;
    });
  const area = (key: string, label: string, rows = 3) => (
    <label className="gc-text">
      <span>{label}</span>
      <textarea rows={rows} maxLength={4000} value={txt[key] ?? ""} onChange={(e) => setTxt({ ...txt, [key]: e.target.value })} />
    </label>
  );

  /** Optional reason box, shown only while the item has a disagreeing mark. */
  const whyBox = (part: string, i: number, mark: string | null | undefined) =>
    mark && DISAGREE.has(mark) ? (
      <label className="gc-why">
        <span>{t.why}</span>
        <textarea rows={2} maxLength={1000} value={why[`${part}:${i}`] ?? ""} onChange={(e) => setWhy({ ...why, [`${part}:${i}`]: e.target.value })} />
      </label>
    ) : null;
  /** Reasons as a list aligned with the items; reasons for agreeing marks are dropped. */
  const reasons = (part: string, ms: Marks, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const m = ms[i];
      return m && DISAGREE.has(m) ? why[`${part}:${i}`] ?? "" : "";
    });

  async function send() {
    if (!g || !month || !year) return setErr(t.needCity);
    setErr("");
    setState("sending");
    try {
      const res = await fetch("/api/guide-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: g.city, visitMonth: Number(month), visitYear: Number(year), lang, things, buy, ease, halal, feel, ...txt,
          thingsWhy: reasons("things", things, g.things.length),
          buyWhy: reasons("buy", buy, g.buy.length),
          easeWhy: reasons("ease", ease, g.ease.length),
        }),
      });
      if (res.ok) {
        setState("done");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErr(res.status === 429 ? t.tooMany : res.status === 400 && (await res.text()) === "Nothing to send" ? t.nothing : t.error);
    } catch {
      setErr(t.error);
    }
    setState("idle");
  }

  return (
    <main className="gc" dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <header className="gc-head">
        <Link href="/" className="gc-back">{t.backToChat}</Link>
        <button type="button" className="gc-lang" onClick={() => setLang(lang === "en" ? "ar" : "en")}>{t.language}</button>
      </header>
      <Image src="/logo-mark.png" alt="Ummah One" className="gc-logo" width={56} height={56} />
      <h1>{t.title}</h1>
      <p className="gc-intro">{t.intro}</p>

      {state === "done" && g ? (
        <section className="gc-card gc-done">
          <p>{t.thanks(g.city)}</p>
          <button type="button" className="gc-submit" onClick={() => reset()}>{t.another}</button>
        </section>
      ) : (
        <>
          <section className="gc-card">
            <label className="gc-field">
              <span>{t.city}</span>
              <select value={city} onChange={(e) => reset(e.target.value)}>
                <option value="">{t.pickCity}</option>
                {sorted.map((c) => (
                  <option key={c.city} value={c.city}>{c.city}, {c.country}</option>
                ))}
              </select>
            </label>
            <div className="gc-field">
              <span>{t.visit}</span>
              <div className="gc-row">
                <select aria-label={t.month} value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="">{t.month}</option>
                  {t.months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select aria-label={t.year} value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">{t.year}</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </section>

          {g && (
            <>
              <section className="gc-card">
                <h2>{t.p1}</h2>
                <p className="gc-hint">{t.p1Hint}</p>
                <ol className="gc-items">
                  {g.things.map((it, i) => (
                    <li key={i}><p dir="ltr">{it}</p><Choice name={it} options={t.thing} value={things[i] ?? null} onChange={setAt(things, setThings, i)} />{whyBox("things", i, things[i])}</li>
                  ))}
                </ol>
                {area("thingsMissing", t.missing)}
              </section>

              <section className="gc-card">
                <h2>{t.p2}</h2>
                <p className="gc-hint">{t.p2Hint}</p>
                <ol className="gc-items">
                  {g.buy.map((it, i) => (
                    <li key={i}><p dir="ltr">{it}</p><Choice name={it} options={t.buy} value={buy[i] ?? null} onChange={setAt(buy, setBuy, i)} />{whyBox("buy", i, buy[i])}</li>
                  ))}
                </ol>
                {area("buyMissing", t.missing)}
              </section>

              <section className="gc-card">
                <h2>{t.p3}</h2>
                <p className="gc-hint">{t.halalQ}</p>
                <Choice name={t.halalQ} options={t.halal} value={halal} onChange={setHalal} />
                {area("halalNote", t.halalNote, 2)}
              </section>

              <section className="gc-card">
                <h2>{t.p4}</h2>
                {g.ease.length ? (
                  <>
                    <p className="gc-hint">{t.p4Hint}</p>
                    <ol className="gc-items">
                      {g.ease.map((e, i) => (
                        <li key={i}><p dir="ltr"><b>{e.name}</b> · {e.score}/10, {e.band}</p><Choice name={e.name} options={t.ease} value={ease[i] ?? null} onChange={setAt(ease, setEase, i)} />{whyBox("ease", i, ease[i])}</li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p className="gc-hint">{t.noEase}</p>
                )}
                {area("easeMissing", t.missing)}
              </section>

              <section className="gc-card">
                <h2>{t.p5}</h2>
                <Choice name={t.p5} options={Object.fromEntries(LABELS.map((l) => [l, LABEL_NAMES[lang][l]]))} value={feel} onChange={setFeel} />
              </section>

              <section className="gc-card">
                {area("more", t.more(g.city), 6)}
              </section>
            </>
          )}

          {err && <p className="gc-err" role="alert">{err}</p>}
          {g && (
            <button type="button" className="gc-submit" disabled={state === "sending"} onClick={send}>
              {state === "sending" ? t.sending : t.submit}
            </button>
          )}
        </>
      )}
    </main>
  );
}
