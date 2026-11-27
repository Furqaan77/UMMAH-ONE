import Chat, { type CityGroup } from "@/components/Chat";
import { cityGuides } from "@/lib/guide-check/content";

// Country order for the city list (Bushra, 25 Nov 2026). A country shows only once it has cities in the data
// (Algeria and Jakarta added 27 Nov 2026). Countries not named here go last, in guide order.
const COUNTRY_ORDER = [
  "Türkiye", "Malaysia", "UAE", "Morocco", "Egypt", "Indonesia", "Kazakhstan", "Tunisia", "Saudi Arabia", "Kyrgyzstan",
  "Uzbekistan", "Bahrain", "Qatar", "Jordan", "Albania", "Algeria", "Maldives", "Oman", "Azerbaijan", "Tanzania",
  "Montenegro", "Bosnia and Herzegovina", "India", "Russia", "Thailand", "Tajikistan", "Pakistan", "Kosovo", "Kuwait",
];

/** The cities we cover, grouped by country (from ALL-81-CITIES.md), in COUNTRY_ORDER. */
function cityGroups(): CityGroup[] {
  const groups = new Map<string, string[]>();
  for (const { city, country } of cityGuides()) groups.set(country, [...(groups.get(country) ?? []), city]);
  const rank = (c: string) => (COUNTRY_ORDER.includes(c) ? COUNTRY_ORDER.indexOf(c) : COUNTRY_ORDER.length);
  return [...groups].map(([country, cities]) => ({ country, cities })).sort((a, b) => rank(a.country) - rank(b.country));
}

export default function Home() {
  return <Chat cities={cityGroups()} />;
}
