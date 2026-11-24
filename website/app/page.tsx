import Chat, { type CityGroup } from "@/components/Chat";
import { cityGuides } from "@/lib/guide-check/content";

/** The cities we cover, grouped by country in guide order (from ALL-81-CITIES.md). */
function cityGroups(): CityGroup[] {
  const groups = new Map<string, string[]>();
  for (const { city, country } of cityGuides()) groups.set(country, [...(groups.get(country) ?? []), city]);
  return [...groups].map(([country, cities]) => ({ country, cities }));
}

export default function Home() {
  return <Chat cities={cityGroups()} />;
}
