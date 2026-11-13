// Rules the model must never break, enforced in code instead of trusting the model (13 Nov 2026).
// Blocked places: lib/rag/blocked.ts. No music for Saudi Arabia, Qatar, Kuwait: Bushra, 13 Nov 2026
// ("purely religious places").
import type { Lang } from "@/lib/i18n";

export const NO_MUSIC_COUNTRIES = ["Saudi Arabia", "Qatar", "Kuwait"];

// "Oud" is not here on purpose: in the guide it is oud perfume.
const MUSIC_EN = /(^|[^\p{L}])(music\w*|concerts?|songs?|sing|singing|singers?|orchestras?|operas?|nasheeds?)($|[^\p{L}])/iu;
const MUSIC_AR = ["موسيق", "غناء", "أغاني", "اغاني", "أغنية", "اغنية", "مغني", "مطرب", "أوبرا", "اوبرا", "حفلة موسيقية", "نشيد", "أناشيد", "اناشيد"];

/** True when the question asks about music, concerts or singing (English or Arabic). */
export function asksMusic(q: string): boolean {
  return MUSIC_EN.test(q) || MUSIC_AR.some((w) => q.includes(w));
}

/** The no-music countries among those asked about. */
export function noMusicCountries(countries: string[]): string[] {
  return countries.filter((c) => NO_MUSIC_COUNTRIES.includes(c));
}

/** Line for the system prompt, for questions that do not ask about music directly. */
export const NO_MUSIC_RULE = `- No music for Saudi Arabia, Qatar or Kuwait: never mention music, concerts, songs, singing, musical instruments or musical performances for any place in these 3 countries, even if you know of some. In these countries "oud" means oud perfume. Follow this rule silently: never mention it.`;

export function blockedReply(places: string[], lang: Lang): string {
  const list = places.join(", ");
  return lang === "ar"
    ? `لا يغطي Ummah One ${list}. اسألني عن مدينة أخرى من مدن الدليل.`
    : `Ummah One does not cover ${list}. Ask me about another city in the guide.`;
}

export function noMusicReply(lang: Lang): string {
  return lang === "ar"
    ? "لا يتناول Ummah One الموسيقى في السعودية وقطر والكويت. يمكنني أن أحدثك عن الثقافة والفن والتراث والأسواق هناك."
    : "Ummah One does not cover music in Saudi Arabia, Qatar or Kuwait. I can tell you about culture, art, heritage and markets there.";
}
