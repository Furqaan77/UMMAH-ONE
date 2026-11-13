"use client";

import { useEffect, useState } from "react";
import * as I from "./Icons";
import type { Strings } from "@/lib/i18n";

export type FeedbackInput = { reasons: string[]; comment: string; consent: boolean };

/** Bottom sheet after 👍 or 👎: reason chips, an optional comment and an opt-in to save the question and answer. */
export default function FeedbackSheet({ rating, t, onClose, onSubmit }: { rating: "up" | "down"; t: Strings; onClose: () => void; onSubmit: (f: FeedbackInput) => void }) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false); // opt-in (minimal GDPR)
  const list = rating === "up" ? t.reasonsUp : t.reasonsDown;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (r: string) => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="fb-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <button className="round-btn" aria-label={t.close} onClick={onClose}>
            <I.Close size={22} />
          </button>
          <h2 id="fb-title">{t.whyRating}</h2>
        </div>
        <div className="sheet-chips" role="group" aria-label={t.whyRating}>
          {list.map((r) => (
            <button key={r} className={`pill ${reasons.includes(r) ? "on" : ""}`} aria-pressed={reasons.includes(r)} onClick={() => toggle(r)}>
              {r}
            </button>
          ))}
        </div>
        <textarea className="sheet-text" dir="auto" rows={4} maxLength={1500} placeholder={t.moreFeedback} value={comment} onChange={(e) => setComment(e.target.value)} />
        <label className="sheet-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{t.consent}</span>
        </label>
        <div className="sheet-foot">
          <button className="submit-btn" onClick={() => onSubmit({ reasons, comment: comment.trim(), consent })}>
            {t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
