// The 4 enjoyment labels (Bushra, 13 Nov 2026). Visitors suggest one; only the team sets a city's label.
export const LABELS = ["very_boring", "boring", "enjoyable", "most_enjoyable"] as const;
export type EnjoymentLabel = (typeof LABELS)[number];

export const LABEL_NAMES: Record<"en" | "ar", Record<EnjoymentLabel, string>> = {
  en: { very_boring: "Very boring", boring: "Boring", enjoyable: "Enjoyable", most_enjoyable: "Most enjoyable" },
  ar: { very_boring: "مملّة جدًا", boring: "مملّة", enjoyable: "ممتعة", most_enjoyable: "الأكثر متعة" },
};

export function isLabel(x: unknown): x is EnjoymentLabel {
  return typeof x === "string" && (LABELS as readonly string[]).includes(x);
}

export const MAX_COMMENT = 500;

/** Rule for the system prompt: labels come only from the team's list in the context. */
export const LABEL_RULE = `- Enjoyment labels (Very boring, Boring, Enjoyable, Most enjoyable) come ONLY from the "Ummah One enjoyment labels" entry in the CONTEXT. Never give a city a label that is not written there, and never call a place boring or enjoyable on your own. A city not listed there has not been rated yet by the Ummah One team.`;

/** First context entry: the team's approved labels, and the label status of the city asked about. */
export function labelsForPrompt(labels: Record<string, EnjoymentLabel>, city?: string | null, available = true): string {
  if (!available)
    return `[0] Ummah One enjoyment labels\nThe labels could not be loaded right now. Do not say whether any city is boring or enjoyable; say the ratings are not available at the moment.`;
  const rows = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, l]) => `- ${c}: ${LABEL_NAMES.en[l]}`);
  const lines = ["[0] Ummah One enjoyment labels (set by the Ummah One team)"];
  if (rows.length) lines.push(...rows, "Every other city: not rated yet.");
  else lines.push(`No city has been rated yet. If asked which places are boring or enjoyable, reply: "The Ummah One team has not rated any city yet. Visitors can share how a city felt to them under answers about that city."`);
  if (city) lines.push(labels[city] ? `This question is about ${city}: rated ${LABEL_NAMES.en[labels[city]]}.` : `This question is about ${city}: NOT rated yet by the Ummah One team. Do not give ${city} any enjoyment label. If asked whether ${city} is boring or enjoyable, reply: "The Ummah One team has not rated ${city} yet." Then you may share what the guide says about ${city}.`);
  return lines.join("\n");
}

/** The chat CONTEXT: the labels entry first, then the passages (or a "no information" line). */
export function buildContext(o: { labels: Record<string, EnjoymentLabel>; city: string | null; passages: string[]; labelsAvailable: boolean }): string {
  const first = labelsForPrompt(o.labels, o.city, o.labelsAvailable);
  return [first, ...(o.passages.length ? o.passages : ["(no matching information in the knowledge base)"])].join("\n\n");
}
