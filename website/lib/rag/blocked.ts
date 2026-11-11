// Places removed for safety on 10 Nov 2026 (terrorism / extreme violence risk). The only copy of this list (AD-8).
export const BLOCKED_PLACES = ["Grozny", "Makhachkala", "Derbent", "Srinagar", "Erbil", "Lahore"];

// Arabic spellings (matched as substrings, so prefixes like "لـ" or "بـ" still match).
const BLOCKED_AR: Record<string, string[]> = {
  Grozny: ["غروزني", "جروزني"],
  Makhachkala: ["محج قلعة", "محجقلعة", "ماخاتشكالا"],
  Derbent: ["دربند", "دربنت"],
  Srinagar: ["سريناغار", "سرينجار"],
  Erbil: ["أربيل", "اربيل", "إربيل", "هولير"],
  Lahore: ["لاهور"],
};

export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i");
}

/** Blocked places named in `text` (whole word, accent- and case-insensitive). */
export function findBlocked(text: string): string[] {
  const t = fold(text);
  return BLOCKED_PLACES.filter(
    (p) => new RegExp(`(^|[^\\p{L}\\p{N}])${fold(p)}($|[^\\p{L}\\p{N}])`, "u").test(t) || (BLOCKED_AR[p] ?? []).some((a) => text.includes(a)),
  );
}
