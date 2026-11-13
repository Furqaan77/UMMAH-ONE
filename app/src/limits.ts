// Same numbers and texts as website/lib/limits-config.ts and website/lib/ratings/labels.ts.
// The app is a separate package, so they are copied here: change both places together.

export const LIMITS = {
  messageChars: 4000,
  messagesPerRequest: 12,
  photosPerRequest: 2,
  commentChars: 500,
  historyChars: 20000, // an earlier answer sent back as history
  photoMaxBytes: 1.5 * 1024 * 1024,
  minuteWindowSec: 60,
} as const;

/** 400 texts from /api/chat (website/lib/limits-config.ts CHAT_ERRORS). */
export const CHAT_ERRORS = {
  tooLong: `Message too long (max ${LIMITS.messageChars} characters)`,
  photo: "Photo too large or not supported (JPEG, PNG or WebP, up to 1.5 MB)",
  tooManyPhotos: `Too many photos (max ${LIMITS.photosPerRequest})`,
} as const;

export const LABELS = ["very_boring", "boring", "enjoyable", "most_enjoyable"] as const;
export type EnjoymentLabel = (typeof LABELS)[number];
export const LABEL_NAMES: Record<"en" | "ar", Record<EnjoymentLabel, string>> = {
  en: { very_boring: "Very boring", boring: "Boring", enjoyable: "Enjoyable", most_enjoyable: "Most enjoyable" },
  ar: { very_boring: "مملّة جدًا", boring: "مملّة", enjoyable: "ممتعة", most_enjoyable: "الأكثر متعة" },
};
export function isLabel(x: unknown): x is EnjoymentLabel {
  return typeof x === "string" && (LABELS as readonly string[]).includes(x);
}

/** The history sent with a request: no error messages, the last 12, earlier answers capped, 2 newest photos. */
export function historyForRequest<T extends { role: string; content: string; image?: string; error?: boolean }>(msgs: T[]): T[] {
  const clean = msgs.filter((m) => !m.error).slice(-LIMITS.messagesPerRequest);
  return withLatestPhotos(clean.map((m) => (m.role === "assistant" && m.content.length > LIMITS.historyChars ? { ...m, content: m.content.slice(0, LIMITS.historyChars) } : m)));
}

/** Decoded size of a base64 data URL photo is within the server limit. */
export function photoFits(dataUrl: string): boolean {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return (b64.length * 3) / 4 <= LIMITS.photoMaxBytes;
}

/** Keeps the photos on the newest messages only; older ones stay in the chat. */
export function withLatestPhotos<T extends { image?: string }>(msgs: T[], max: number = LIMITS.photosPerRequest): T[] {
  let left = max;
  return [...msgs]
    .reverse()
    .map((m) => (m.image && m.image !== "attached" ? (left-- > 0 ? m : { ...m, image: undefined }) : m))
    .reverse();
}

/** Which message to show for a failed /api/chat response. */
export function chatErrorKey(status: number, body: string, retryAfter: string | null):
  "tooManyToday" | "tooManyMessages" | "tooLarge" | "msgTooLong" | "tooManyPhotos" | "photoBad" | "genericError" {
  if (status === 429) {
    const wait = Number(retryAfter);
    return Number.isFinite(wait) && wait > LIMITS.minuteWindowSec ? "tooManyToday" : "tooManyMessages";
  }
  if (status === 413) return "tooLarge";
  if (status === 400 && body === CHAT_ERRORS.tooLong) return "msgTooLong";
  if (status === 400 && body === CHAT_ERRORS.tooManyPhotos) return "tooManyPhotos";
  if (status === 400 && body === CHAT_ERRORS.photo) return "photoBad";
  return "genericError";
}
