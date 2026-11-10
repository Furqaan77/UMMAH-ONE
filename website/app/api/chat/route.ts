import { retrieve } from "@/lib/retrieve";
import { detectLang, type Lang } from "@/lib/i18n";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const TEXT_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:7b";

function systemPrompt(context: string, lang: Lang | "auto") {
  const langRule =
    lang === "auto"
      ? "Reply in the same language the user writes in (English or Arabic)."
      : lang === "ar"
        ? "Always reply in Arabic."
        : "Always reply in English.";
  return `You are Ummah One, a friendly AI guide to Muslim travel cities, education cities, and Muslim businesses and artists.

RULES
- Answer ONLY from the CONTEXT below. If the answer is not in the context, say you don't have that information yet and that the team is adding it. Never guess or use outside knowledge. Never cite Wikipedia.
- Use plain, simple language and short paragraphs.
- Do not give visa rules, prices, maps, day-by-day itineraries, or prayer times.
- No sectarian or political content.
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

  const hits = retrieve(last.content);
  const context = hits.map((h, i) => `[${i + 1}] ${h.title}: ${h.text}`).join("\n");
  const sources = hits.map((h) => ({ id: h.id, title: h.title, source: h.source }));
  const replyLang: Lang = body.lang === "auto" ? detectLang(last.content) : body.lang;

  const hasImage = messages.some((m) => m.image);
  const model = hasImage ? VISION_MODEL : TEXT_MODEL;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      send({ type: "sources", sources });

      try {
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: true,
            think: false,
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
            if (j.message?.content) send({ type: "text", text: j.message.content });
          }
        }
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
