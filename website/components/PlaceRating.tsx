"use client";

import { useEffect, useState } from "react";
import { LABELS, LABEL_NAMES, MAX_COMMENT, isLabel, type EnjoymentLabel } from "@/lib/ratings/labels";
import type { Lang, Strings } from "@/lib/i18n";

const DEVICE_KEY = "uo.device";
const RATED_KEY = "uo.rated";

let memoryId = ""; // used when storage is blocked, so one visit keeps one id

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    memoryId ||= Math.random().toString(36).slice(2) + Date.now().toString(36);
    return memoryId;
  }
}
function loadRated(): Record<string, EnjoymentLabel> {
  try {
    const o: unknown = JSON.parse(localStorage.getItem(RATED_KEY) ?? "{}");
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o).filter(([, l]) => isLabel(l))) as Record<string, EnjoymentLabel>;
  } catch {
    return {};
  }
}

/** Under an answer about one travel city: the team's approved label (if any) and the visitor rating box. */
export default function PlaceRating({ city, label, lang, t, flash }: { city: string; label: EnjoymentLabel | null; lang: Lang; t: Strings; flash: (m: string) => void }) {
  const [rated, setRated] = useState<EnjoymentLabel | null>(null);
  const [editing, setEditing] = useState(false);
  const [visited, setVisited] = useState(false);
  const [choice, setChoice] = useState<EnjoymentLabel | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const names = LABEL_NAMES[lang];

  useEffect(() => setRated(loadRated()[city] ?? null), [city]);

  async function submit() {
    if (!visited || !choice) return;
    setSending(true);
    try {
      const res = await fetch("/api/place-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId(), city, label: choice, visited, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      try {
        localStorage.setItem(RATED_KEY, JSON.stringify({ ...loadRated(), [city]: choice }));
      } catch {
        /* ignore */
      }
      setRated(choice);
      setEditing(false);
      flash(t.thanks);
    } catch {
      flash(t.rateError);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="place-rating">
      {label && <div className="place-badge">{t.ratingBadge(names[label])}</div>}
      {rated && !editing ? (
        <div className="place-done">
          <span>{t.youRated(city, names[rated])}</span>
          <button className="link-btn" onClick={() => { setEditing(true); setVisited(false); setChoice(rated); setComment(""); }}>
            {t.rateChange}
          </button>
        </div>
      ) : (
        <div className="place-box">
          <div className="place-q">{t.rateQ(city)}</div>
          <label className="place-visited">
            <input type="checkbox" checked={visited} onChange={(e) => setVisited(e.target.checked)} />
            <span>{t.visited(city)}</span>
          </label>
          <div className="place-labels" role="group" aria-label={t.rateQ(city)}>
            {LABELS.map((l) => (
              <button key={l} aria-pressed={choice === l} disabled={!visited} className={`chip ${choice === l ? "on" : ""}`} onClick={() => setChoice(l)}>
                {names[l]}
              </button>
            ))}
          </div>
          {visited && choice && (
            <>
              <textarea
                className="place-comment"
                dir="auto"
                rows={2}
                maxLength={MAX_COMMENT}
                placeholder={t.rateComment}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="note">{t.rateCommentNote}</div>
              <div className="place-send">
                <button className="chip on" disabled={sending} onClick={submit}>
                  {t.send}
                </button>
              </div>
            </>
          )}
          {!visited && <div className="note">{t.rateNeedVisit}</div>}
        </div>
      )}
    </div>
  );
}
