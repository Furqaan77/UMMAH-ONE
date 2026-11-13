import { search, label, placesIn, IndexMissing } from "@/lib/rag/search";
import type { Chunk } from "@/lib/rag/types";
import { detectLang, type Lang } from "@/lib/i18n";
import { LABEL_RULE, buildContext, type EnjoymentLabel } from "@/lib/ratings/labels";
import { ratableCity, travelCities } from "@/lib/ratings/cities";
import { ratingStore } from "@/lib/ratings/store";
import { LIMITS, checkChatMessages, clientIp, limit, readJson, tooMany } from "@/lib/limits";
import { NO_MUSIC_RULE, asksMusic, blockedReply, noMusicCountries, noMusicReply } from "@/lib/rag/rules";
import { findBlocked } from "@/lib/rag/blocked";
import { arabicHints } from "@/lib/rag/arabic";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const TEXT_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct";
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:3b";

type Style = "longer" | "shorter";
const STYLE_RULE: Record<Style, string> = {
  longer: "\n- The user asked for a LONGER answer: give more detail from the CONTEXT (still only from the CONTEXT).",
  shorter: "\n- The user asked for a SHORTER answer: reply in 2–4 short sentences or bullets.",
};

function systemPrompt(context: string, lang: Lang | "auto", noMusic: boolean, style?: Style) {
  const langRule =
    lang === "auto"
      ? "Reply in the same language the user writes in (English or Arabic)."
      : lang === "ar"
        ? "Always reply in Arabic."
        : "Always reply in English.";
  return `You are Ummah One, a friendly AI guide to Muslim travel cities, education cities, and Muslim businesses and artists.

RULES
- Answer ONLY from the CONTEXT below. If the answer is not in the context, reply: "I don't have that information yet. The Ummah One team is adding it." (in the user's language). Never guess or use outside knowledge. Never cite Wikipedia.
- Keep it very simple: start with the direct answer, then short sentences and everyday words. Use a short bullet list for places or things to buy (usually 5–8 items, the best first). No long introductions.
- Ease-of-visit scores (out of 10): give the score and say what it means in plain words (e.g. "very easy: metro goes there"). Shopping: say what to buy, then one short tip on checking it is real.
- Do not give visa rules, prices, maps, day-by-day itineraries, or prayer times.
- No sectarian or political content.
- Halal only: never recommend or describe food or drink with pork or alcohol, or places whose main offer is alcohol (bars, pubs, beach clubs). If the user asks for them, say kindly that Ummah One only recommends halal options. You may repeat a pork or alcohol warning only if it is written in the CONTEXT; never add one yourself.
- Keep dish names and ingredients exactly as in the context. When replying in Arabic, keep the original dish name in Latin letters in brackets.
- For travel questions, remind the user to check official travel advice.
- For trip recommendations, ask for any missing details: budget, travel month, interests, travel style, number of days (students: field of study and level). Say WHY you recommend each place.
${noMusic ? NO_MUSIC_RULE + "\n" : ""}${LABEL_RULE}
- ${langRule}${style ? STYLE_RULE[style] : ""}

CONTEXT
${context}`;
}

export async function POST(req: Request) {
  // Rate limit first (every request counts, even rejected ones), then size and content checks.
  // A rejected request never reaches search or the model.
  const rl = limit(`chat:${clientIp(req)}`, { minute: LIMITS.chatPerMinute, day: LIMITS.chatPerDay });
  if (!rl.ok) return tooMany(rl.retryAfter);
  const read = await readJson<{ messages?: unknown; lang?: Lang | "auto"; style?: unknown }>(req, LIMITS.body.chat);
  if (!read.ok) return read.res;
  const all = Array.isArray(read.value?.messages) ? (read.value.messages as unknown[]) : [];
  const recentMsgs = all.slice(-LIMITS.messagesPerRequest);
  const bad = checkChatMessages(recentMsgs);
  if (bad) return new Response(bad, { status: 400 });
  const style: Style | undefined = read.value?.style === "longer" || read.value?.style === "shorter" ? read.value.style : undefined;
  const body = { messages: recentMsgs as Msg[], lang: read.value?.lang ?? "auto" };
  const messages = body.messages;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return new Response("Bad request", { status: 400 });

  let hits: Chunk[] = [];
  let searchError = "";
  let place: { city: string; label: EnjoymentLabel | null } | null = null;
  let askedCity: string | null = null;
  let labels: Record<string, EnjoymentLabel> = {};
  let labelsAvailable = true;
  let blocked: string[] = [];
  let askedCountries: string[] = [];
  let namedPlace = false;
  let namedRegion = false;
  // Team labels load alongside the search; if they fail, the model is told they are unavailable (not "unrated").
  const labelsP = ratingStore()
    .getLabels()
    .catch((e) => {
      console.error("[chat] labels", e);
      labelsAvailable = false;
      return {} as Record<string, EnjoymentLabel>;
    });
  try {
    const r = await search(last.content);
    hits = r.chunks;
    blocked = r.blocked;
    askedCountries = r.countries;
    namedPlace = r.places.length > 0;
    namedRegion = r.places.some((p) => p.kind === "region");
    // A follow-up that names no place ("is there music there?") is about the place in the latest earlier
    // user message that names one.
    if (!namedPlace && !blocked.length)
      for (let i = messages.length - 2; i >= 0; i--) {
        if (messages[i].role !== "user") continue;
        const earlierBlocked = findBlocked(`${messages[i].content} ${arabicHints(messages[i].content)}`);
        if (earlierBlocked.length) {
          blocked = earlierBlocked;
          hits = [];
          break;
        }
        const p = placesIn(messages[i].content);
        if (p.places.length) {
          askedCountries = p.countries;
          break;
        }
      }
    const cities = travelCities();
    // Only labels for current travel cities are used.
    labels = Object.fromEntries(Object.entries(await labelsP).filter(([c]) => cities.includes(c)));
    // A question about exactly one travel city: the answer gets the rating box and its approved label, if any.
    askedCity = ratableCity(r.places, cities);
    if (askedCity) place = { city: askedCity, label: labels[askedCity] ?? null };
  } catch (e) {
    searchError = e instanceof IndexMissing ? e.message : `Search failed: ${e instanceof Error ? e.message : e}`;
  }
  const passages = hits.map((h, i) => `[${i + 1}] (${h.category}) ${label(h)}\n${h.text}`);
  // The team's enjoyment labels always come first; they are the only source for "boring / enjoyable".
  const context = buildContext({ labels, city: askedCity, passages, labelsAvailable });
  const sources = hits.map((h) => ({ id: h.id, title: label(h), source: h.source }));
  const replyLang: Lang = body.lang === "auto" ? detectLang(last.content) : body.lang;

  // Hard rules answered in code, never by the model: removed places, and music in Saudi Arabia, Qatar, Kuwait.
  const fixed = blocked.length
    ? blockedReply(blocked, replyLang)
    : asksMusic(last.content) && noMusicCountries(askedCountries).length
      ? noMusicReply(replyLang)
      : null;
  if (fixed) {
    const out = [{ type: "sources", sources: [], model: null }, { type: "text", text: fixed }].map((o) => JSON.stringify(o) + "\n").join("");
    return new Response(out, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  }

  // The no-music rule goes in the prompt only when it can matter: those countries asked about or in the sources,
  // no place named, or a music question about a region ("music in the Gulf"). Elsewhere the model tends to
  // repeat the rule aloud.
  const noMusic =
    !namedPlace ||
    (namedRegion && asksMusic(last.content)) ||
    noMusicCountries(askedCountries).length > 0 ||
    noMusicCountries(hits.map((h) => h.meta.country ?? "")).length > 0;

  const hasImage = messages.some((m) => m.image);
  const model = hasImage ? VISION_MODEL : TEXT_MODEL;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      send({ type: "sources", sources, model });
      if (place) send({ type: "place", ...place });
      if (searchError) {
        send({ type: "error", text: searchError });
        controller.close();
        return;
      }

      try {
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: true,
            think: false,
            options: { num_ctx: 8192 }, // room for the longer city guides
            messages: [
              { role: "system", content: systemPrompt(context, body.lang, noMusic, style) },
              ...messages.map((m) => ({
                role: m.role,
                content: m.content,
                ...(m.image ? { images: [m.image.replace(/^data:image\/\w+;base64,/, "")] } : {}),
              })),
            ],
          }),
        });
        if (!res.ok || !res.body) throw new Error(`Ollama ${res.status}: ${await res.text().catch(() => "")}`);

        // Use an Instruct model (no thinking). As a safety net, if the answer starts with "<think>",
        // hold it back until "</think>" and drop the thinking part.
        let pending = "";
        let passed = false;
        const push = (chunk: string) => {
          if (passed) return void send({ type: "text", text: chunk });
          pending += chunk;
          const head = pending.trimStart();
          if (head.length < 7 && "<think>".startsWith(head)) return; // could still be "<think>"
          if (!head.startsWith("<think>")) passed = true;
          else {
            const end = pending.indexOf("</think>");
            if (end === -1) return;
            pending = pending.slice(end + "</think>".length).replace(/^\s+/, "");
            passed = true;
          }
          if (pending) send({ type: "text", text: pending });
          pending = "";
        };

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const j = JSON.parse(line) as { message?: { content?: string }; error?: string };
            if (j.error) throw new Error(j.error);
            if (j.message?.content) push(j.message.content);
          }
        }
        // Stream ended without a closing tag: send it only if it was not thinking.
        if (!passed && pending && !pending.includes("<think>")) send({ type: "text", text: pending.trim() });
      } catch (err) {
        console.error("[chat]", err);
        const offline =
          replyLang === "ar"
            ? `نموذج الذكاء الاصطناعي غير متصل. شغّل Ollama وحمّل النموذج (${model}) ثم حاول مرة أخرى.`
            : `The AI model is offline. Start Ollama and pull the model (${model}), then try again.`;
        send({ type: "error", text: offline });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
