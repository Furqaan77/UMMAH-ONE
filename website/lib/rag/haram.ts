// Halal rule (Bushra, 11 Nov 2026): never include food that might involve alcohol, pork or anything haram.
// Applied at ingest to every list item (dishes, things to do). Removed items are listed in the ingest report.
// Prose that WARNS about pork/alcohol ("some stalls use pork", "alcohol is not sold") is kept: it helps travellers.
// The team can extend these lists.

/** Words that mean pork, alcohol or other clearly haram food. */
export const HARAM_WORDS = [
  // pork
  "pork", "pig", "pigs", "swine", "ham", "bacon", "lard", "prosciutto", "pancetta", "salami", "pepperoni", "chorizo",
  "gelatin", "gelatine", "blood sausage", "black pudding",
  // alcohol
  "alcohol", "alcoholic", "wine", "wines", "winery", "vineyard", "beer", "beers", "brewery", "ale", "lager", "vodka",
  "whisky", "whiskey", "brandy", "cognac", "rakija", "raki", "rakı", "ouzo", "arak", "arrack", "liqueur", "liquor",
  "sake", "soju", "mirin", "cocktail", "cocktails", "champagne", "cider", "toddy", "palm wine", "rum",
];

/** Dishes known to be made with pork or alcohol, even when the text does not say so. */
export const HARAM_DISHES = [
  "buzara", "black risotto", "black cuttlefish risotto", "black squid risotto", "crni rižot",
  // Disputed foods removed by Ummah One policy (Bushra, 11 Nov 2026: option c): horse meat and fermented mare's milk.
  // Riding a horse is fine; only eating or drinking these is removed. Seafood is kept.
  "horse meat", "horse-meat", "horsemeat", "horse sausage", "kazy", "kazi", "qazy", "kazy-karta", "zhal-zhaya",
  "kymyz", "kumis", "kumys", "koumiss", "qymyz", "mare's milk", "mare’s milk", "shubat", "babi guling", "lechon", "char siu", "siu yuk", "bak kut teh", "lap cheong", "coq au vin", "tiramisu", "sangria",
];

/**
 * Sending someone TO a place where alcohol is the main thing served ("at a rooftop lounge", "visit a pub").
 * Passing by is fine ("a corniche lined with beach clubs"), and so are "juice bar", "sand bar" and the town of Bar.
 */
const VENUE = "pubs?|taverns?|konoba|nightclubs?|night clubs?|beach clubs?|rooftop lounges?|cocktail lounges?|wine bars?|(?<!(?:juice|sand|snack|salad|coffee|tea|shisha|milkshake|fruit)\\s)bars?";
const VENUES = new RegExp(`\\b(?:[Aa]t|[Ii]n|[Tt]o|[Vv]isit|[Vv]isiting|[Tt]ry|[Ee]njoy|[Jj]oin)\\s+(?:a|an|the|one of the|some)?\\s*(?:[\\p{Ll}-]+\\s+){0,2}?(${VENUE})\\b`, "u");

// Proper names that contain a haram word but are not food or drink.
const NAME_EXCEPTIONS = /\bwadi rum\b|\brumi\b|\brum\s+(?:desert|village)\b/gi;

const WORDS = new RegExp(`(^|[^\\p{L}])(${[...HARAM_WORDS, ...HARAM_DISHES].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})($|[^\\p{L}])`, "iu");

/** The haram word, dish or venue an item names, or null. */
export function haramReason(item: string): string | null {
  const t = item.replace(NAME_EXCEPTIONS, " ");
  const w = WORDS.exec(t);
  if (w) return w[2].toLowerCase();
  const v = VENUES.exec(t); // case-sensitive: "Bar" (the Montenegrin town) is not a venue
  return v ? v[1].toLowerCase() : null;
}

const ITEM_START = /^\s*(\d+[.)]|[-*•])\s+/;

const DISHES = new RegExp(`(^|[^\\p{L}])(${HARAM_DISHES.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})($|[^\\p{L}])`, "iu");

/** In normal paragraphs, a sentence that names a known haram dish is a recommendation: remove that sentence. */
function removeDishSentences(line: string, removed: string[]): string {
  if (!DISHES.test(line)) return line;
  return line
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const m = DISHES.exec(sentence);
      if (m) removed.push(`${sentence.trim()} (${m[2].toLowerCase()})`);
      return !m;
    })
    .join(" ");
}

/**
 * Remove list items that name haram food, drink or alcohol venues.
 * An item is its marker line plus following lines that are not a new item (PDF lines wrap).
 */
export function removeHaramItems(text: string): { text: string; removed: string[] } {
  const lines = text.split("\n");
  const out: string[] = [];
  const removed: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!ITEM_START.test(lines[i])) {
      out.push(removeDishSentences(lines[i++], removed));
      continue;
    }
    const item = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !ITEM_START.test(lines[i]) && !/^\s*$/.test(lines[i]) && item.length < 6 && !/[.!?)]$/.test(item[item.length - 1].trim())) item.push(lines[i++]);
    const joined = item.join(" ");
    const why = haramReason(joined);
    if (why) removed.push(`${joined.replace(/\s+/g, " ").trim()} (${why})`);
    else out.push(...item);
  }
  return { text: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), removed };
}
