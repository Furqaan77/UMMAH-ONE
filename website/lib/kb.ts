// Sample knowledge base. Built ONLY from prompt.md (the master decisions file).
// Every entry is marked "sample, to verify". Real content will be added by the team later.

export type KbEntry = {
  id: string;
  title: string;
  text: string;
  source: string;
  keywords: string[];
};

const SOURCE = "Ummah One team research (prompt.md) — sample, to verify";

const regions: Record<string, string[]> = {
  "Middle East and Gulf": ["Dubai", "Abu Dhabi", "Sharjah", "AlUla", "Jeddah", "Riyadh", "Abha", "Al Ahsa", "Doha", "Muscat", "Salalah", "Manama", "Kuwait City", "Amman", "Aqaba", "Baku", "Ganja", "Dammam"],
  "Türkiye": ["Istanbul", "Cappadocia/Göreme", "Antalya", "Bodrum", "Pamukkale", "Fethiye", "Izmir", "Trabzon", "Bursa", "Marmaris", "Alanya", "Konya", "Ankara"],
  "Balkans": ["Kotor", "Budva", "Mostar", "Sarajevo", "Ohrid", "Skopje", "Tirana", "Prizren", "Pristina", "Podgorica", "Tetovo"],
  "North Africa": ["Marrakesh", "Essaouira", "Cairo", "Sharm El Sheikh", "Hurghada", "Alexandria", "Tangier", "Rabat", "Casablanca", "Tunis", "Djerba", "Sousse"],
  "Central Asia": ["Samarkand", "Bukhara", "Almaty", "Tashkent", "Khiva", "Astana", "Bishkek", "Turkistan", "Dushanbe", "Shymkent"],
  "Southeast and South Asia": ["Bali", "Langkawi", "Kuala Lumpur", "Penang", "Yogyakarta", "Baa Atoll", "Malé", "Hunza Valley", "Skardu"],
  "East Africa": ["Zanzibar City / Stone Town"],
  "Thailand": ["Satun", "Koh Lanta"],
  "India": ["Kozhikode", "Lakshadweep", "Hyderabad", "Lucknow"],
  "Russia": ["Kazan"],
};

const halalFriendliness = ["Bali", "Kotor", "Budva", "Podgorica", "Ohrid"];
// Removed 10 Nov 2026 (terrorism / extreme violence risk): Grozny, Makhachkala, Derbent, Srinagar, Erbil, Lahore.

const extraFacts: Record<string, string> = {
  Lucknow: "Lucknow is about 26% Muslim (city, 2011 census).",
  Hyderabad: "Hyderabad is about 30% Muslim (city) and 43% (district).",
  Satun: "Satun is 68–77% Muslim, depending on the source.",
  "Koh Lanta": "No verified Muslim population figure was found for Koh Lanta.",
};

const education: [string, string][] = [
  ["Kuala Lumpur", "Universiti Malaya (QS 2026: 58th; QS 2027: 56th)"],
  ["Istanbul", "ITU, Boğaziçi, Istanbul University, Koç, Sabancı"],
  ["Riyadh", "King Saud University, Princess Nourah University"],
  ["Dhahran/Dammam", "KFUPM (QS 2026: 67th)"],
  ["Ankara", "METU, Bilkent"],
  ["Doha", "Education City (Weill Cornell Medicine–Qatar, Texas A&M at Qatar), Qatar University"],
  ["Abu Dhabi", "Khalifa University, NYU Abu Dhabi"],
  ["Penang", "Universiti Sains Malaysia"],
  ["Cairo", "Cairo University, Ain Shams University"],
  ["Astana", "Nazarbayev University (THE 2026: 401–500), Astana Medical University"],
  ["Almaty", "Al-Farabi KazNU, Kazakh National Medical University"],
  ["Dubai", "MBRU, Dubai Medical College, branch campuses"],
  ["İzmir", "IZTECH, Ege University"],
  ["Amman", "University of Jordan, JUST"],
  ["Baku", "Baku State University, Azerbaijan Medical University"],
  ["Alexandria", "Alexandria University"],
  ["Tashkent", "National University of Uzbekistan, Tashkent Pediatric Medical Institute"],
  ["Rabat", "Mohammed V University"],
];

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i").trim();
}

function words(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function build(): KbEntry[] {
  const out: KbEntry[] = [];
  const total = Object.values(regions).flat().length;

  for (const [region, cities] of Object.entries(regions)) {
    out.push({
      id: `region-${region}`,
      title: `${region}: travel cities`,
      text: `Ummah One travel cities in ${region} (${cities.length}): ${cities.join(", ")}.`,
      source: SOURCE,
      keywords: [...words(region), ...cities.flatMap(words), "region", "cities", "travel"],
    });

    for (const city of cities) {
      const parts = [`${city} is one of the ${total} Ummah One travel cities, in the ${region} region.`];
      if (halalFriendliness.includes(city)) parts.push(`${city} has a "halal-friendliness" label: check halal food and Muslim-friendly options before you go.`);
      if (extraFacts[city]) parts.push(extraFacts[city]);
      const edu = education.find(([c]) => c.split("/").some((x) => norm(city) === norm(x)));
      if (edu) parts.push(`${city} is also one of the 18 education cities. Flagship institutions: ${edu[1]}.`);
      parts.push("Detailed city information (halal food, budget, best season, family and women ratings, heritage) will be added by the team.");
      out.push({ id: `city-${city}`, title: city, text: parts.join(" "), source: SOURCE, keywords: [...words(city), ...words(region)] });
    }
  }

  out.push({
    id: "all-cities",
    title: `The ${total} travel cities`,
    text: `Ummah One covers ${total} travel cities: ${Object.entries(regions).map(([r, c]) => `${r} (${c.length})`).join("; ")}. Cities with a halal-friendliness label: ${halalFriendliness.join(", ")}.`,
    source: SOURCE,
    keywords: [String(total), "cities", "places", "all", "list", "travel", "where", "destinations", "halal", "safety", "safe", "label"],
  });

  out.push({
    id: "education-all",
    title: "The 18 education cities",
    text: `Ummah One points students to 18 education cities (ranked): ${education.map(([c, u], i) => `${i + 1}. ${c}: ${u}`).join("; ")}. Information only: no scholarships and no application help.`,
    source: SOURCE,
    keywords: ["education", "study", "student", "students", "university", "universities", "college", "degree", "medicine", "phd", "masters", "course", "qs", "the", "ranking"],
  });

  for (const [city, unis] of education) {
    out.push({
      id: `edu-${city}`,
      title: `Study in ${city}`,
      text: `${city} is an Ummah One education city. Flagship institutions: ${unis}. Estimated tuition and living costs will be added later (information only).`,
      source: SOURCE,
      keywords: [...words(city), ...words(unis), "study", "university", "education", "student"],
    });
  }

  out.push({
    id: "about",
    title: "About Ummah One",
    text: "Ummah One is an AI guide. It helps people find Muslim travel cities that match their preferences, points students to 18 education cities, and helps people discover and support Muslim businesses and artists (crafts, carpets, calligraphy, modest fashion, art, music, perfume). It is open to everyone. Answers come only from the Ummah One knowledge base, with sources. To get a recommendation, tell the AI your budget, travel month, interests, travel style and number of days.",
    source: SOURCE,
    keywords: ["ummah", "one", "about", "what", "who", "help", "business", "businesses", "artist", "artists", "recommend", "plan", "trip"],
  });

  return out;
}

export const KB: KbEntry[] = build();
