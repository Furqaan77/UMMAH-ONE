// Limit numbers and error texts, shared by the server routes and the chat screen (no server-only code here).
// All numbers are estimates (13 Nov 2026): change them here.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const LIMITS = {
  chatPerMinute: { max: 20, windowMs: MIN },
  chatPerDay: { max: 300, windowMs: DAY },
  ratingsPerHour: { max: 20, windowMs: HOUR },
  feedbackPerHour: { max: 30, windowMs: HOUR },
  adminFailedLogins: { max: 5, windowMs: 15 * MIN },
  body: { chat: 4 * 1024 * 1024, rating: 4 * 1024, feedback: 32 * 1024, admin: 4 * 1024 },
  messageChars: 4000, // a user message
  historyChars: 20000, // an earlier assistant answer sent back as history
  messagesPerRequest: 12,
  photo: { maxBytes: 1.5 * 1024 * 1024, maxPerRequest: 2, types: ["jpeg", "png", "webp"] },
} as const;

/** 400 texts from /api/chat. The chat screen picks its message by these exact texts. */
export const CHAT_ERRORS = {
  tooLong: `Message too long (max ${LIMITS.messageChars} characters)`,
  photo: "Photo too large or not supported (JPEG, PNG or WebP, up to 1.5 MB)",
  tooManyPhotos: `Too many photos (max ${LIMITS.photo.maxPerRequest})`,
  bad: "Bad message",
} as const;

/** Keeps the photos on the newest messages only (the server allows LIMITS.photo.maxPerRequest); older ones stay in the chat. */
export function withLatestPhotos<T extends { image?: string }>(msgs: T[], max: number = LIMITS.photo.maxPerRequest): T[] {
  let left = max;
  return [...msgs]
    .reverse()
    .map((m) => (m.image && m.image !== "attached" ? (left-- > 0 ? m : { ...m, image: undefined }) : m))
    .reverse();
}
