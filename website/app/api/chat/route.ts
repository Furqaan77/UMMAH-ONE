import { search, label, IndexMissing } from "@/lib/rag/search";
import type { Chunk } from "@/lib/rag/types";
import { detectLang, type Lang } from "@/lib/i18n";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const TEXT_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct";
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:3b";

function systemPrompt(context: string, lang: Lang | "auto") {
  const langRule =
    lang === "auto"
      ? "Reply in the same language the user writes in (English or Arabic)."
      : lang === "ar"
        ? "Always reply in Arabic."
        : "Always reply in English.";
  return `You are Ummah One, a friendly AI guide to Muslim travel cities, education cities, and Muslim businesses and artists.

RULES
- Answer ONLY from the CONTEXT below. If the answer is not in the context, reply: "I don't have that information yet. The Ummah One team is adding it." (in the user's language). Never guess or use outside knowledge. Never cite Wikipedia.
- Use plain, simple language and short paragraphs.
- Do not give visa rules, prices, maps, day-by-day itineraries, or prayer times.
- No sectarian or political content.
- Halal only: never recommend or describe food or drink with pork or alcohol, or places whose main offer is alcohol (bars, pubs, beach clubs). If the user asks for them, say kindly that Ummah One only recommends halal options. You may repeat warnings from the context, such as "some stalls use pork, look for halal signs".
- Keep dish names and ingredients exactly as in the context. When replying in Arabic, keep the original dish name in Latin letters in brackets.
- For travel questions, remind the user to check official travel advice.
- For trip recommendations, ask for any missing details: budget, travel month, interests, travel style, number of days (students: field of study and level). Say WHY you recommend each place.
- ${langRule}

CONTEXT
${context || "(no matching information in the knowledge base)"}`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { messages: Msg[]; lang: Lang | "auto" };
  const messages = (body.messages ?? []).slice(-12);
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return new Response("Bad request", { status: 400 });

  let hits: Chunk[] = [];
  let searchError = "";
  try {
    hits = (await search(last.content)).chunks;
  } catch (e) {
    searchError = e instanceof IndexMissing ? e.message : `Search failed: ${e instanceof Error ? e.message : e}`;
  }
  const context = hits.map((h, i) => `[${i + 1}] (${h.category}) ${label(h)}\n${h.text}`).join("\n\n");
  const sources = hits.map((h) => ({ id: h.id, title: label(h), source: h.source }));
  const replyLang: Lang = body.lang === "auto" ? detectLang(last.content) : body.lang;

  const hasImage = messages.some((m) => m.image);
  const model = hasImage ? VISION_MODEL : TEXT_MODEL;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      send({ type: "sources", sources });
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
              { role: "system", content: systemPrompt(context, body.lang) },
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
