"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as I from "./Icons";
import Answer from "./Answer";
import PlaceRating from "./PlaceRating";
import FeedbackSheet, { type FeedbackInput } from "./FeedbackSheet";
import type { EnjoymentLabel } from "@/lib/ratings/labels";
import { T, detectLang, type Lang, type LangSetting } from "@/lib/i18n";
import { CHAT_ERRORS, LIMITS, withLatestPhotos } from "@/lib/limits-config";

type Source = { id: string; title: string; source: string };
type Style = "longer" | "shorter";
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  sources?: Source[];
  error?: boolean;
  rating?: "up" | "down";
  place?: { city: string; label: EnjoymentLabel | null };
  at?: number; // when the answer was made
  model?: string | null; // null: a fixed reply from Ummah One's rules
};
type ChatT = { id: string; title: string; messages: Message[]; updatedAt: number };

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const CHATS_KEY = "uo.chats";
const LANG_KEY = "uo.lang";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: ignore */
  }
}

async function resizeImage(file: File, max = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new window.Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Plain text for reading aloud: no markdown marks. */
function plain(md: string): string {
  return md.replace(/[#*_`>]+/g, "").replace(/\[(\d+)\]/g, "").replace(/\s+/g, " ").trim();
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous?: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};
function speechRec(): (new () => SpeechRec) | null {
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return W.SpeechRecognition ?? W.webkitSpeechRecognition ?? null;
}

type Menu = { kind: "more"; id: string; up: boolean } | { kind: "lang" } | { kind: "chat" } | null;

export default function Chat() {
  const [chats, setChats] = useState<ChatT[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [langSetting, setLangSetting] = useState<LangSetting>("auto");
  const [browserLang, setBrowserLang] = useState<Lang>("en");
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [openSources, setOpenSources] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ id: string; rating: "up" | "down" } | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [listening, setListening] = useState<"mic" | "voice" | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRec | null>(null);

  const uiLang: Lang = langSetting === "auto" ? browserLang : langSetting;
  const t = T[uiLang];
  const current = chats.find((c) => c.id === currentId) ?? null;
  const messages = current?.messages ?? [];

  // Load saved state once.
  useEffect(() => {
    setChats(load<ChatT[]>(CHATS_KEY, []));
    setLangSetting(load<LangSetting>(LANG_KEY, "auto"));
    setBrowserLang(navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en");
    setReady(true);
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    // Saved chats keep the rating box but not the label: a label the team later changes or clears must not linger.
    if (ready)
      save(
        CHATS_KEY,
        chats.map((c) => ({
          ...c,
          messages: c.messages.map(({ image, place, ...m }) => ({ ...m, image: image ? "attached" : undefined, place: place ? { city: place.city, label: null } : undefined })),
        })),
      );
  }, [chats, ready]);
  useEffect(() => {
    if (ready) save(LANG_KEY, langSetting);
  }, [langSetting, ready]);

  useEffect(() => {
    document.documentElement.lang = uiLang;
    document.documentElement.dir = uiLang === "ar" ? "rtl" : "ltr";
  }, [uiLang]);

  // Escape closes any open menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setPlusOpen(false);
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (atBottom) scrollToBottom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    if (menu?.kind === "more") setMenu(null);
  };

  // Auto-grow the input.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const updateChat = useCallback((id: string, fn: (c: ChatT) => ChatT) => {
    setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const patchMsg = useCallback(
    (chatId: string, msgId: string, fn: (m: Message) => Message) =>
      updateChat(chatId, (c) => ({ ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)) })),
    [updateChat],
  );

  // ---------- reading aloud ----------
  function speak(id: string, text: string) {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) {
      flash(t.voiceUnsupported);
      return;
    }
    synth.cancel();
    if (speaking === id) {
      setSpeaking(null);
      return;
    }
    const u = new SpeechSynthesisUtterance(plain(text));
    u.lang = detectLang(text) === "ar" ? "ar-SA" : "en-US";
    u.onend = () => setSpeaking((s) => (s === id ? null : s));
    u.onerror = () => setSpeaking((s) => (s === id ? null : s));
    setSpeaking(id);
    synth.speak(u);
  }

  // ---------- chat ----------
  async function runAssistant(chatId: string, history: Message[], opts: { style?: Style; speakAfter?: boolean } = {}) {
    const aId = uid();
    updateChat(chatId, (c) => ({ ...c, messages: [...history, { id: aId, role: "assistant", content: "", at: Date.now() }] }));
    setStreaming(true);
    setAtBottom(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let full = "";
    let failed = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          lang: langSetting,
          style: opts.style,
          messages: withLatestPhotos(history.filter((m) => !m.error).slice(-LIMITS.messagesPerRequest).map((m) => (m.role === "assistant" && m.content.length > LIMITS.historyChars ? { ...m, content: m.content.slice(0, LIMITS.historyChars) } : m))).map((m) => ({ role: m.role, content: m.content, image: m.image && m.image !== "attached" ? m.image : undefined })),
        }),
      });
      if (!res.ok) {
        // Limits: 429 too many, 413 too large, 400 message or photo rejected.
        const why = res.status === 400 ? await res.text().catch(() => "") : "";
        const wait = Number(res.headers.get("retry-after"));
        const text =
          res.status === 429 ? (Number.isFinite(wait) && wait > LIMITS.chatPerMinute.windowMs / 1000 ? t.tooManyToday : t.tooManyMessages)
          : res.status === 413 ? t.tooLarge
          : why === CHAT_ERRORS.tooLong ? t.msgTooLong
          : why === CHAT_ERRORS.tooManyPhotos ? t.tooManyPhotos
          : why === CHAT_ERRORS.photo ? t.photoBad
          : t.genericError;
        failed = true;
        patchMsg(chatId, aId, (m) => ({ ...m, sources: [], content: text, error: true }));
        return;
      }
      if (!res.body) throw new Error("No response");
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
          const ev = JSON.parse(line) as { type: string; text?: string; sources?: Source[]; model?: string | null; city?: string; label?: EnjoymentLabel | null };
          if (ev.type === "sources") patchMsg(chatId, aId, (m) => ({ ...m, sources: ev.sources, model: ev.model === undefined ? undefined : ev.model }));
          else if (ev.type === "place" && ev.city) patchMsg(chatId, aId, (m) => ({ ...m, place: { city: ev.city!, label: ev.label ?? null } }));
          else if (ev.type === "text") {
            full += ev.text ?? "";
            patchMsg(chatId, aId, (m) => ({ ...m, content: m.content + (ev.text ?? "") }));
          } else if (ev.type === "error") {
            failed = true;
            patchMsg(chatId, aId, (m) => ({ ...m, content: ev.text ?? "Error", error: true }));
          }
        }
      }
    } catch (e) {
      failed = true;
      if ((e as Error).name !== "AbortError") patchMsg(chatId, aId, (m) => ({ ...m, error: true, content: t.genericError }));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (opts.speakAfter && !failed && full) speak(aId, full);
    }
  }

  function send(textArg?: string, opts: { speakAfter?: boolean } = {}) {
    const text = (textArg ?? input).trim();
    if ((!text && !image) || streaming) return;
    const userMsg: Message = { id: uid(), role: "user", content: text || (uiLang === "ar" ? "ما هذا المكان؟" : "What is this place?"), image: image ?? undefined };
    let chatId = currentId;
    let history: Message[];
    if (!current) {
      chatId = uid();
      history = [userMsg];
      const chat: ChatT = { id: chatId, title: userMsg.content.slice(0, 60), messages: history, updatedAt: Date.now() };
      setChats((cs) => [chat, ...cs]);
      setCurrentId(chatId);
    } else {
      history = [...current.messages, userMsg];
    }
    setInput("");
    setImage(null);
    setPlusOpen(false);
    void runAssistant(chatId!, history, opts);
  }

  /** Answer the same question again, optionally longer or shorter. Replaces that answer. */
  function redo(msgId: string, style?: Style) {
    setMenu(null);
    if (!current || streaming) return;
    const idx = current.messages.findIndex((m) => m.id === msgId);
    const history = current.messages.slice(0, idx);
    if (history.length && history[history.length - 1].role === "user") void runAssistant(current.id, history, { style });
  }

  function newChat() {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setSpeaking(null);
    setCurrentId(null);
    setDrawer(false);
    setMenu(null);
    setInput("");
    setImage(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function deleteChat(id: string) {
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (id === currentId) setCurrentId(null);
    setMenu(null);
  }

  async function copy(m: Message) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(m.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      flash("Copy failed");
    }
  }

  async function shareText(text: string) {
    try {
      if (navigator.share) await navigator.share({ title: "Ummah One", text });
      else {
        await navigator.clipboard.writeText(text);
        flash(t.copied);
      }
    } catch {
      /* user cancelled */
    }
  }
  const share = (m: Message) => shareText(`${m.content}\n\n— Ummah One`);
  function shareChat() {
    setMenu(null);
    if (!current) return;
    const text = current.messages.filter((m) => !m.error).map((m) => `${m.role === "user" ? "Q" : "A"}: ${m.content}`).join("\n\n");
    void shareText(`${text}\n\n— Ummah One`);
  }

  // ---------- feedback ----------
  async function sendFeedback(m: Message, rating: "up" | "down", f?: FeedbackInput) {
    if (!current) return;
    patchMsg(current.id, m.id, (x) => ({ ...x, rating }));
    const idx = current.messages.findIndex((x) => x.id === m.id);
    const question = current.messages.slice(0, idx).reverse().find((x) => x.role === "user")?.content;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: current.id,
          messageId: m.id,
          rating,
          reasons: f?.reasons,
          comment: f?.comment || undefined,
          // The question and answer are saved only when the visitor ticks the consent box.
          ...(f?.consent ? { question, answer: m.content } : {}),
        }),
      });
      flash(res.ok ? t.thanks : res.status === 429 ? t.tooManyFeedback : t.feedbackError);
    } catch {
      flash(t.feedbackError);
    }
  }
  function openSheet(m: Message, rating: "up" | "down") {
    setMenu(null);
    if (current) patchMsg(current.id, m.id, (x) => ({ ...x, rating }));
    setSheet({ id: m.id, rating });
  }
  function closeSheet(f?: FeedbackInput) {
    const s = sheet;
    setSheet(null);
    const m = s && messages.find((x) => x.id === s.id);
    if (s && m) void sendFeedback(m, s.rating, f);
  }

  // ---------- voice ----------
  function stopListening() {
    recRef.current?.stop();
  }
  /** mic: speech fills the input. voice: speech is sent, and the answer is read aloud. */
  function listen(kind: "mic" | "voice") {
    if (listening) {
      stopListening();
      return;
    }
    const Ctor = speechRec();
    if (!Ctor) {
      flash(kind === "mic" ? t.micUnsupported : t.voiceUnsupported);
      return;
    }
    window.speechSynthesis?.cancel();
    setSpeaking(null);
    const rec = new Ctor();
    rec.lang = uiLang === "ar" ? "ar-SA" : "en-US";
    rec.interimResults = true;
    const base = input ? input.trimEnd() + " " : "";
    let heard = "";
    rec.onresult = (e) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      heard = s;
      setInput(base + s);
    };
    rec.onend = () => {
      setListening(null);
      if (kind === "voice" && heard.trim()) send(base + heard, { speakAfter: true });
    };
    rec.onerror = () => setListening(null);
    recRef.current = rec;
    setListening(kind);
    rec.start();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setImage(await resizeImage(f));
      setPlusOpen(false);
      inputRef.current?.focus();
    } catch {
      flash("Could not read the photo");
    }
  }

  function openMore(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    if (menu?.kind === "more" && menu.id === id) return setMenu(null);
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ kind: "more", id, up: r.top > 380 });
  }

  const timeOf = (ms?: number) => {
    if (!ms) return "";
    const d = new Date(ms);
    const time = new Intl.DateTimeFormat(uiLang === "ar" ? "ar" : "en", { hour: "numeric", minute: "2-digit" }).format(d);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? `${t.today} · ${time}` : `${new Intl.DateTimeFormat(uiLang === "ar" ? "ar" : "en", { day: "numeric", month: "short" }).format(d)} · ${time}`;
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const canSend = (input.trim() !== "" || image !== null) && !streaming;
  const langName = langSetting === "auto" ? t.auto : langSetting === "en" ? "English" : "العربية";
  const sheetMsg = sheet && messages.find((m) => m.id === sheet.id);

  return (
    <div className="app">
      {/* Top bar: floating round buttons over the conversation */}
      <header className="topbar">
        <button className="round-btn" aria-label="Menu" onClick={() => setDrawer(true)}>
          <I.Menu size={24} />
        </button>
        <div className="brand">
          <span className="brand-name">Ummah One</span>
          <div className="pop-anchor">
            <button className="lang-btn" aria-haspopup="menu" aria-expanded={menu?.kind === "lang"} aria-label={t.language} onClick={() => setMenu(menu?.kind === "lang" ? null : { kind: "lang" })}>
              <I.Globe size={15} />
              <span>{langName}</span>
              <I.ChevronDown size={15} />
            </button>
            {menu?.kind === "lang" && (
              <div className="pop pop-down" role="menu">
                <div className="pop-label">{t.language}</div>
                {(["auto", "en", "ar"] as const).map((l) => (
                  <button key={l} role="menuitemradio" aria-checked={langSetting === l} onClick={() => { setLangSetting(l); setMenu(null); }}>
                    <span className="pop-check">{langSetting === l && <I.Check size={18} />}</span>
                    {l === "auto" ? t.auto : l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="top-pill pop-anchor">
          <button className="pill-btn" aria-label={t.newChat} title={t.newChat} onClick={newChat}>
            <I.Pencil size={22} />
          </button>
          <button className="pill-btn" aria-label={t.chatOptions} title={t.chatOptions} aria-haspopup="menu" aria-expanded={menu?.kind === "chat"} onClick={() => setMenu(menu?.kind === "chat" ? null : { kind: "chat" })}>
            <I.More size={22} />
          </button>
          {menu?.kind === "chat" && (
            <div className="pop pop-down pop-end" role="menu">
              <button role="menuitem" onClick={newChat}>
                <I.Pencil size={20} /> {t.newChat}
              </button>
              <button role="menuitem" disabled={!current} onClick={shareChat}>
                <I.Upload size={20} /> {t.shareChat}
              </button>
              <button role="menuitem" className="danger" disabled={!current} onClick={() => current && deleteChat(current.id)}>
                <I.Trash size={20} /> {t.deleteChat}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="thread">
          {messages.length === 0 && (
            <div className="welcome">
              <Image src="/logo-mark.png" alt="Ummah One" width={64} height={59} priority />
              <h1>{ready ? t.welcome(new Date().getHours()) : " "}</h1>
              <div className="starters">
                <button className="starter" onClick={() => send(t.planTripPrompt)}>
                  <I.Plane size={20} /> {t.planTrip}
                </button>
                <button className="starter" onClick={() => send(t.findUniPrompt)}>
                  <I.Cap size={20} /> {t.findUni}
                </button>
                <button className="starter" onClick={() => send(t.findBizPrompt)}>
                  <I.Store size={20} /> {t.findBiz}
                </button>
              </div>
              <div className="suggest">
                <div className="suggest-label">{t.suggestions}</div>
                {t.suggest.map((s) => (
                  <button key={s} className="suggest-item" dir="auto" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="user-row">
                <div className="user-bubble" dir="auto">
                  {m.image && m.image !== "attached" && <img className="user-img" src={m.image} alt="" />}
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="ai">
                {m.sources === undefined && !m.content ? (
                  <div className="meta pulse">
                    <I.Book size={20} />
                    <span>{t.thinking}</span>
                  </div>
                ) : (
                  <>
                    <button className="meta" onClick={() => setOpenSources((o) => ({ ...o, [m.id]: !o[m.id] }))} disabled={!m.sources?.length} aria-expanded={!!openSources[m.id]}>
                      <I.Book size={20} />
                      <span>{m.sources?.length ? t.sources(m.sources.length) : t.noSources}</span>
                      {!!m.sources?.length && <I.Chevron size={16} className={`chev ${openSources[m.id] ? "open" : ""}`} />}
                    </button>
                    {openSources[m.id] && m.sources && (
                      <ol className="sources">
                        {m.sources.map((s) => (
                          <li key={s.id}>
                            <strong>{s.title}</strong>
                            <span>{s.source}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )}

                <div className={`answer ${m.error ? "error" : ""}`} dir="auto">
                  <Answer text={m.content} />
                  {streaming && m.id === lastAssistantId && <span className="caret" />}
                </div>

                {!(streaming && m.id === lastAssistantId) && m.content && (
                  <div className="actions">
                    <button className="act" aria-label={t.copy} title={t.copy} onClick={() => copy(m)}>
                      {copied === m.id ? <I.Check /> : <I.Copy />}
                    </button>
                    <button className="act" aria-label={t.share} title={t.share} onClick={() => share(m)}>
                      <I.Upload />
                    </button>
                    {!m.error && (
                      <button className={`act ${speaking === m.id ? "on" : ""}`} aria-label={speaking === m.id ? t.stopReading : t.readAloud} title={speaking === m.id ? t.stopReading : t.readAloud} onClick={() => speak(m.id, m.content)}>
                        {speaking === m.id ? <I.Stop size={20} /> : <I.Speaker />}
                      </button>
                    )}
                    {!m.error && (
                      <>
                        <button className={`act ${m.rating === "up" ? "on" : ""}`} aria-pressed={m.rating === "up"} aria-label={t.like} title={t.like} onClick={() => openSheet(m, "up")}>
                          <I.ThumbUp />
                        </button>
                        <button className={`act ${m.rating === "down" ? "on" : ""}`} aria-pressed={m.rating === "down"} aria-label={t.dislike} title={t.dislike} onClick={() => openSheet(m, "down")}>
                          <I.ThumbDown />
                        </button>
                      </>
                    )}
                    <>
                      <button className={`act ${menu?.kind === "more" && menu.id === m.id ? "on" : ""}`} aria-label={t.more} title={t.more} aria-haspopup="menu" aria-expanded={menu?.kind === "more" && menu.id === m.id} onClick={(e) => openMore(e, m.id)}>
                        <I.More />
                      </button>
                      {menu?.kind === "more" && menu.id === m.id && (
                        <div className={`pop ${menu.up ? "pop-up" : "pop-down"}`} role="menu">
                          {m.at && <div className="pop-label">{timeOf(m.at)}</div>}
                          <button role="menuitem" disabled={!m.sources?.length} onClick={() => { setOpenSources((o) => ({ ...o, [m.id]: true })); setMenu(null); }}>
                            <I.Sources size={20} /> {t.showSources}
                          </button>
                          <button role="menuitem" onClick={() => openSheet(m, "down")}>
                            <I.Flag size={20} /> {t.report}
                          </button>
                          <div className="pop-sep" />
                          {m.model !== undefined && <div className="pop-label">{m.model ? t.answeredWith(m.model) : t.answeredByRules}</div>}
                          <button role="menuitem" disabled={streaming || m.model === null} onClick={() => redo(m.id, "longer")}>
                            <I.Longer size={20} /> {t.longer}
                          </button>
                          <button role="menuitem" disabled={streaming || m.model === null} onClick={() => redo(m.id, "shorter")}>
                            <I.Shorter size={20} /> {t.shorter}
                          </button>
                          <button role="menuitem" disabled={streaming} onClick={() => redo(m.id)}>
                            <I.Retry size={20} /> {t.retry}
                          </button>
                        </div>
                      )}
                    </>
                  </div>
                )}

                {m.place && !m.error && !(streaming && m.id === lastAssistantId) && m.content && (
                  <PlaceRating city={m.place.city} label={m.place.label} lang={uiLang} t={t} flash={flash} />
                )}

                {m.id === lastAssistantId && !streaming && m.content && <p className="ai-note">{t.aiNote}</p>}
              </div>
            ),
          )}
        </div>
      </main>

      {/* Click-away layer for menus */}
      {menu && <div className="click-away" onClick={() => setMenu(null)} />}

      {/* Floating scroll button */}
      {!atBottom && messages.length > 0 && (
        <button className="fab" aria-label={t.scrollDown} onClick={() => scrollToBottom()}>
          <I.ArrowDown size={22} />
        </button>
      )}

      {/* Input bar */}
      <footer className="composer-wrap">
        {plusOpen && (
          <>
            <div className="click-away" onClick={() => setPlusOpen(false)} />
            <div className="pop plus-menu" role="menu">
              <button role="menuitem" onClick={() => fileRef.current?.click()}>
                <I.Photo size={22} /> {t.addPhoto}
              </button>
              <div className="pop-sep" />
              <button role="menuitem" onClick={() => send(t.planTripPrompt)}>
                <I.Plane size={22} /> {t.planTrip}
              </button>
              <button role="menuitem" onClick={() => send(t.findUniPrompt)}>
                <I.Cap size={22} /> {t.findUni}
              </button>
              <button role="menuitem" onClick={() => send(t.findBizPrompt)}>
                <I.Store size={22} /> {t.findBiz}
              </button>
            </div>
          </>
        )}
        <div className={`composer ${listening ? "is-listening" : ""}`}>
          {image && (
            <div className="preview">
              <img src={image} alt="" />
              <button aria-label="Remove photo" onClick={() => setImage(null)}>
                <I.Close size={14} />
              </button>
            </div>
          )}
          <div className="composer-row">
            <button className={`plus ${plusOpen ? "on" : ""}`} aria-label={t.attach} aria-expanded={plusOpen} onClick={() => setPlusOpen((v) => !v)}>
              <I.Plus size={26} />
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              maxLength={LIMITS.messageChars}
              dir="auto"
              value={input}
              placeholder={listening ? t.voiceListening : t.placeholder}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className={`mic ${listening === "mic" ? "live" : ""}`} aria-label={t.mic} title={t.mic} aria-pressed={listening === "mic"} onClick={() => listen("mic")}>
              <I.Mic size={24} />
            </button>
            {streaming ? (
              <button className="go" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                <I.Stop size={18} />
              </button>
            ) : canSend ? (
              <button className="go" aria-label={t.send} title={t.send} onClick={() => send()}>
                <I.ArrowUp size={22} />
              </button>
            ) : (
              <button className={`go voice ${listening === "voice" ? "live" : ""}`} aria-label={t.voiceMode} title={t.voiceMode} aria-pressed={listening === "voice"} onClick={() => listen("voice")}>
                <I.Voice size={24} />
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </footer>

      {/* Drawer */}
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
      <aside className={`drawer ${drawer ? "open" : ""}`} aria-hidden={!drawer}>
        <div className="drawer-head">
          <Image src="/logo-mark.png" alt="" width={30} height={28} />
          <span>Ummah One</span>
          <button className="round-btn flat push" aria-label={t.close} onClick={() => setDrawer(false)}>
            <I.Close size={22} />
          </button>
        </div>
        <button className="drawer-new" onClick={newChat}>
          <I.Pencil size={20} /> {t.newChat}
        </button>
        <div className="drawer-label">{t.history}</div>
        <div className="drawer-list">
          {chats.length === 0 && <div className="drawer-empty">{t.noHistory}</div>}
          {[...chats]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((c) => (
              <div key={c.id} className={`drawer-item ${c.id === currentId ? "active" : ""}`}>
                <button
                  className="drawer-item-title"
                  dir="auto"
                  onClick={() => {
                    setCurrentId(c.id);
                    setDrawer(false);
                  }}
                >
                  {c.title}
                </button>
                <button className="act sm" aria-label={t.deleteChat} title={t.deleteChat} onClick={() => deleteChat(c.id)}>
                  <I.Trash size={18} />
                </button>
              </div>
            ))}
        </div>
        <div className="drawer-foot">
          <div className="drawer-label">{t.language}</div>
          <div className="seg">
            {(["auto", "en", "ar"] as const).map((l) => (
              <button key={l} className={langSetting === l ? "on" : ""} onClick={() => setLangSetting(l)}>
                {l === "auto" ? t.auto : l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
          <p className="drawer-note">{t.historyNote}</p>
        </div>
      </aside>

      {/* Feedback sheet (👍 / 👎 / report) */}
      {sheet && sheetMsg && <FeedbackSheet rating={sheet.rating} t={t} onClose={() => closeSheet()} onSubmit={(f) => closeSheet(f)} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
