// Knowledge base.
// Travel: the team's "Halal Travel — 81 City Guides" (data/city-guides.md). Marked "to verify".
// Education and About: from prompt.md (sample, to verify).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type KbEntry = {
  id: string;
  title: string;
  text: string;
  source: string;
  keywords: string[];
  names?: string[]; // city names; a strong match when the question contains one
};

const SOURCE = "Ummah One team research (prompt.md) — sample, to verify";
const GUIDE_SOURCE = "Halal Travel — 81 City Guides (Ummah One team) — to verify";

type Guide = { city: string; country: string; region: string; names: string[]; overview: string; things: string };

// Parse data/city-guides.md: "# Region — subtitle", "## City, Country", then overview text and "### 20 Things to Do".
function loadGuides(): Guide[] {
  const md = readFileSync(join(process.cwd(), "data", "city-guides.md"), "utf8");
  const out: Guide[] = [];
  let region = "";
  for (const block of md.split(/^(?=#{1,2} )/m)) {
    const head = block.split("\n", 1)[0];
    if (/^# /.test(head)) {
      if (!/City Guides/.test(head)) region = head.slice(2).split(" — ")[0].trim();
      continue;
    }
    if (!/^## /.test(head)) continue;
    const [cityPart, country = ""] = head.slice(3).split(/,\s*(?=[^,]+$)/);
    const body = block.slice(head.length).replace(/^---\s*$/gm, "").trim();
    const [overview, things = ""] = body.split(/^### .*$/m);
    const city = cityPart.trim();
    const names = [city, ...city.split(/[()]/).map((x) => x.trim())].filter((x) => x.length > 2);
    out.push({ city, country: country.trim(), region, names: [...new Set(names)], overview: overview.replace(/\*\*/g, "").trim(), things: things.trim() });
  }
  return out;
}

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


// Arabic search words (so Arabic questions find the same entries).
const AR_REGION: Record<string, string[]> = {
  "Middle East and Gulf": ["الشرق", "الأوسط", "الخليج", "الخليجية"],
  "Türkiye": ["تركيا"],
  "Balkans": ["البلقان"],
  "North Africa": ["شمال", "أفريقيا", "افريقيا", "المغرب", "مصر", "تونس"],
  "Central Asia": ["آسيا", "اسيا", "الوسطى"],
  "Southeast and South Asia": ["آسيا", "اسيا", "جنوب", "شرق", "ماليزيا", "إندونيسيا", "اندونيسيا", "باكستان", "المالديف"],
  "East Africa": ["زنجبار", "تنزانيا"],
  "Thailand": ["تايلاند"],
  "India": ["الهند"],
  "Russia": ["روسيا"],
};
const AR_CITY: Record<string, string[]> = {
  Dubai: ["دبي"], "Abu Dhabi": ["أبوظبي", "ابوظبي", "أبو", "ظبي"], Sharjah: ["الشارقة"], AlUla: ["العلا"], Jeddah: ["جدة"],
  Riyadh: ["الرياض"], Abha: ["أبها"], Doha: ["الدوحة"], Muscat: ["مسقط"], Salalah: ["صلالة"], Manama: ["المنامة"],
  "Kuwait City": ["الكويت"], Amman: ["عمان", "عمّان"], Aqaba: ["العقبة"], Baku: ["باكو"], Dammam: ["الدمام"],
  Istanbul: ["إسطنبول", "اسطنبول"], Antalya: ["أنطاليا", "انطاليا"], Ankara: ["أنقرة", "انقرة"], Konya: ["قونية"], Bursa: ["بورصة"], Izmir: ["إزمير", "ازمير"],
  Sarajevo: ["سراييفو"], Mostar: ["موستار"], Tirana: ["تيرانا"], Skopje: ["سكوبيه"],
  Marrakesh: ["مراكش"], Cairo: ["القاهرة"], Alexandria: ["الإسكندرية", "الاسكندرية"], Tangier: ["طنجة"], Rabat: ["الرباط"],
  Casablanca: ["الدار", "البيضاء"], Tunis: ["تونس"], Djerba: ["جربة"], Sousse: ["سوسة"], Hurghada: ["الغردقة"], "Sharm El Sheikh": ["شرم", "الشيخ"],
  Samarkand: ["سمرقند"], Bukhara: ["بخارى"], Tashkent: ["طشقند"], Khiva: ["خيوة"], Almaty: ["ألماتي", "الماتي"], Astana: ["أستانا", "استانا"],
  Bali: ["بالي"], "Kuala Lumpur": ["كوالالمبور"], Penang: ["بينانغ"], Langkawi: ["لنكاوي"], Malé: ["ماليه"],
  "Zanzibar City / Stone Town": ["زنجبار"], Hyderabad: ["حيدر", "أباد", "حيدرآباد"], Lucknow: ["لكناو"], Kazan: ["قازان"],
};
const AR_EDU = ["جامعة", "جامعات", "الجامعات", "الجامعة", "دراسة", "الدراسة", "أدرس", "ادرس", "طالب", "طلاب", "الطلاب", "تعليم", "التعليم", "طب", "الطب", "ماجستير", "دكتوراه"];
const AR_TRAVEL = ["مدن", "المدن", "سفر", "السفر", "وجهات", "سياحة", "السياحة", "رحلة", "أسافر", "اسافر", "حلال"];

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i").trim();
}

function words(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const RATING_WORDS = ["calm", "quiet", "peaceful", "peace", "tranquil", "tranquility", "relax", "relaxing", "healing", "busy", "loud", "crowded", "tourism", "tourists", "touristy", "modern", "traditional", "historic", "history", "vintage", "cultural", "culture", "rating", "ratings", "score", "best", "most", "least", "calmest", "quietest", "busiest", "peaceful", "oldest", "modernest", "compare"];
const STOPWORDS = new Set(["the", "and", "for", "with", "from", "that", "this", "are", "its", "into", "your", "you", "but", "can", "all", "has", "was", "one", "out", "over", "their", "they", "where", "which", "while", "more", "most", "also", "here", "there", "city"]);

function arCity(city: string): string[] {
  return Object.entries(AR_CITY).filter(([k]) => k.split("/").some((x) => norm(city).includes(norm(x).split(" (")[0]) || norm(x).includes(norm(city)))).flatMap(([, v]) => v);
}

function build(): KbEntry[] {
  const out: KbEntry[] = [];
  const guides = loadGuides();
  const total = guides.length;
  const regions: Record<string, string[]> = {};
  for (const g of guides) (regions[g.region] ??= []).push(g.city);

  for (const g of guides) {
    const base = [...g.names.flatMap(words), ...words(g.country), ...words(g.region), ...arCity(g.city), ...(AR_REGION[g.region] ?? [])];
    const extra: string[] = [];
    if (halalFriendliness.includes(g.city)) extra.push(`${g.city} has a "halal-friendliness" label: check halal food and Muslim-friendly options before you go.`);
    const fact = Object.entries(extraFacts).find(([c]) => norm(c) === norm(g.city));
    if (fact) extra.push(fact[1]);
    const edu = education.find(([c]) => c.split("/").some((x) => norm(g.city) === norm(x)));
    if (edu) extra.push(`${g.city} is also one of the 18 education cities. Flagship institutions: ${edu[1]}.`);
    const where = `${g.city}, ${g.country} (${g.region}).`;
    const overview = [where, g.overview, ...extra].join("\n");
    out.push({
      id: `city-${g.city}`,
      title: `${g.city}, ${g.country}`,
      text: overview,
      source: GUIDE_SOURCE,
      names: g.names,
      keywords: [...base, ...words(g.overview.replace(/^(Calm|Character|Energy):.*$/gm, "")).filter((w) => w.length > 2 && !STOPWORDS.has(w)), "masjid", "mosque", "halal"],
    });
    if (g.things) {
      out.push({
        id: `todo-${g.city}`,
        title: `Things to do in ${g.city}`,
        text: `${where}\nThings to do:\n${g.things}`,
        source: GUIDE_SOURCE,
        names: g.names,
        keywords: [...base, ...words(g.things).filter((w) => w.length > 2 && !STOPWORDS.has(w)), "things", "do", "see", "visit", "activities", "attractions", "places", "sights", "trip", "plan"],
      });
    }
  }

  // One ratings table per region, so "calmest / most historic" questions can compare cities.
  for (const [region, cities] of Object.entries(regions)) {
    const lines = guides
      .filter((g) => g.region === region)
      .map((g) => `${g.city}, ${g.country}: ${g.overview.split("\n").filter((l) => /^(Calm|Character|Energy):/.test(l)).map((l) => l.replace(/^(Calm|Character|Energy):\s*/, "")).join(" · ")}`);
    out.push({
      id: `ratings-${region}`,
      title: `${region}: city ratings`,
      text: `Ratings out of 10 for ${region} cities (Tranquility & Peace, Healing, Traditional, Historic & Vintage, Cultural, Modern, Busy & Loud, Too Much Tourism):\n${lines.join("\n")}`,
      source: GUIDE_SOURCE,
      names: [region],
      keywords: [...words(region), ...cities.flatMap(words), ...(AR_REGION[region] ?? []), ...RATING_WORDS, "compare", "which", "region"],
    });
  }

  for (const [region, cities] of Object.entries(regions)) {
    out.push({
      id: `region-${region}`,
      title: `${region}: travel cities`,
      text: `Ummah One travel cities in ${region} (${cities.length}): ${cities.join(", ")}.`,
      source: GUIDE_SOURCE,
      names: [region],
      keywords: [...words(region), ...cities.flatMap(words), ...(AR_REGION[region] ?? []), ...cities.flatMap(arCity), "region", "cities", "travel", ...AR_TRAVEL],
    });
  }

  out.push({
    id: "all-cities",
    title: `The ${total} travel cities`,
    text: `Ummah One covers ${total} travel cities: ${Object.entries(regions).map(([r, c]) => `${r} (${c.length})`).join("; ")}. Cities with a halal-friendliness label: ${halalFriendliness.join(", ")}.`,
    source: SOURCE,
    keywords: [String(total), "cities", "places", "all", "list", "travel", "where", "destinations", "halal", "safety", "safe", "label", ...AR_TRAVEL],
  });

  out.push({
    id: "education-all",
    title: "The 18 education cities",
    text: `Ummah One points students to 18 education cities (ranked): ${education.map(([c, u], i) => `${i + 1}. ${c}: ${u}`).join("; ")}. Information only: no scholarships and no application help.`,
    source: SOURCE,
    keywords: ["education", "study", "student", "students", "university", "universities", "college", "degree", "medicine", "phd", "masters", "course", "qs", "the", "ranking", ...AR_EDU],
  });

  for (const [city, unis] of education) {
    out.push({
      id: `edu-${city}`,
      title: `Study in ${city}`,
      text: `${city} is an Ummah One education city. Flagship institutions: ${unis}. Estimated tuition and living costs will be added later (information only).`,
      source: SOURCE,
      keywords: [...words(city), ...words(unis), ...Object.entries(AR_CITY).filter(([k]) => city.split("/").some((c) => norm(c) === norm(k))).flatMap(([, v]) => v), "study", "university", "education", "student", ...AR_EDU],
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
