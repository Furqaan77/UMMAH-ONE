"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as I from "./Icons";
import Answer from "./Answer";
import { T, type Lang, type LangSetting } from "@/lib/i18n";

type Source = { id: string; title: string; source: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  sources?: Source[];
  error?: boolean;
  rating?: "up" | "down";
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

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

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
  const [dislikeFor, setDislikeFor] = useState<string | null>(null);
  const [dislikeText, setDislikeText] = useState("");
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [listening, setListening] = useState(false);
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
  }, []);

  useEffect(() => {
    if (ready) save(CHATS_KEY, chats.map((c) => ({ ...c, messages: c.messages.map(({ image, ...m }) => ({ ...m, image: image ? "attached" : undefined })) })));
  }, [chats, ready]);
  useEffect(() => {
    if (ready) save(LANG_KEY, langSetting);
  }, [langSetting, ready]);

  useEffect(() => {
    document.documentElement.lang = uiLang;
    document.documentElement.dir = uiLang === "ar" ? "rtl" : "ltr";
  }, [uiLang]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

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

  async function runAssistant(chatId: string, history: Message[]) {
    const aId = uid();
    updateChat(chatId, (c) => ({ ...c, messages: [...history, { id: aId, role: "assistant", content: "" }] }));
    setStreaming(true);
    setAtBottom(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          lang: langSetting,
          messages: history.map((m) => ({ role: m.role, content: m.content, image: m.image && m.image !== "attached" ? m.image : undefined })),
        }),
      });
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
          const ev = JSON.parse(line) as { type: string; text?: string; sources?: Source[] };
          if (ev.type === "sources") patchMsg(chatId, aId, (m) => ({ ...m, sources: ev.sources }));
          else if (ev.type === "text") patchMsg(chatId, aId, (m) => ({ ...m, content: m.content + (ev.text ?? "") }));
          else if (ev.type === "error") patchMsg(chatId, aId, (m) => ({ ...m, content: ev.text ?? "Error", error: true }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        patchMsg(chatId, aId, (m) => ({ ...m, error: true, content: uiLang === "ar" ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again." }));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function send(textArg?: string) {
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
    void runAssistant(chatId!, history);
  }

  function retry(msgId: string) {
    if (!current || streaming) return;
    const idx = current.messages.findIndex((m) => m.id === msgId);
    const history = current.messages.slice(0, idx);
    if (history.length && history[history.length - 1].role === "user") void runAssistant(current.id, history);
  }

  function newChat() {
    abortRef.current?.abort();
    setCurrentId(null);
    setDrawer(false);
    setInput("");
    setImage(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function deleteChat(id: string) {
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (id === currentId) setCurrentId(null);
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

  async function share(m: Message) {
    const text = `${m.content}\n\n— Ummah One`;
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

  async function sendFeedback(m: Message, rating: "up" | "down", comment?: string) {
    if (!current) return;
    patchMsg(current.id, m.id, (x) => ({ ...x, rating }));
    const idx = current.messages.findIndex((x) => x.id === m.id);
    const question = current.messages.slice(0, idx).reverse().find((x) => x.role === "user")?.content;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: current.id, messageId: m.id, rating, comment, question, answer: m.content }),
      });
      flash(t.thanks);
    } catch {
      flash("Could not send feedback");
    }
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      flash(t.micUnsupported);
      return;
    }
    const rec = new Ctor();
    rec.lang = uiLang === "ar" ? "ar-SA" : "en-US";
    rec.interimResults = true;
    const base = input ? input.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      setInput(base + s);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
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

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const canSend = (input.trim() !== "" || image !== null) && !streaming;

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <button className="icon-btn" aria-label="Menu" onClick={() => setDrawer(true)}>
          <I.Menu size={26} />
        </button>
        <h1 className="title">Ummah One</h1>
        <button className="icon-btn push" aria-label={t.newChat} onClick={newChat}>
          <I.NewChat size={26} />
        </button>
      </header>

      {/* Messages */}
      <main className="scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="thread">
          {messages.length === 0 && (
            <div className="welcome">
              <Image src="/logo-mark.png" alt="Ummah One" width={72} height={66} priority />
              <p>{ready ? t.welcome(new Date().getHours()) : "\u00a0"}</p>
              <span className="note">{t.disclaimer}</span>
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
                    <I.Book size={22} />
                    <span>{t.thinking}</span>
                  </div>
                ) : (
                  <>
                    <button
                      className="meta"
                      onClick={() => setOpenSources((o) => ({ ...o, [m.id]: !o[m.id] }))}
                      disabled={!m.sources?.length}
                      aria-expanded={!!openSources[m.id]}
                    >
                      <I.Book size={22} />
                      <span>{m.sources?.length ? t.sources(m.sources.length) : t.noSources}</span>
                      {!!m.sources?.length && <I.Chevron size={18} className={`chev ${openSources[m.id] ? "open" : ""}`} />}
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
                    <button className="icon-btn sm" aria-label={t.copy} title={t.copy} onClick={() => copy(m)}>
                      {copied === m.id ? <I.Check /> : <I.Copy />}
                    </button>
                    <button className={`icon-btn sm ${m.rating === "up" ? "on" : ""}`} aria-label={t.like} title={t.like} onClick={() => sendFeedback(m, "up")}>
                      <I.ThumbUp />
                    </button>
                    <button
                      className={`icon-btn sm ${m.rating === "down" ? "on" : ""}`}
                      aria-label={t.dislike}
                      title={t.dislike}
                      onClick={() => {
                        setDislikeFor(m.id);
                        setDislikeText("");
                      }}
                    >
                      <I.ThumbDown />
                    </button>
                    <button className="icon-btn sm" aria-label={t.share} title={t.share} onClick={() => share(m)}>
                      <I.Share />
                    </button>
                    <button className="icon-btn sm" aria-label={t.retry} title={t.retry} onClick={() => retry(m.id)}>
                      <I.Retry />
                    </button>
                    <div className="more-wrap">
                      <button className="icon-btn sm" aria-label={t.more} title={t.more} onClick={() => setMoreFor(moreFor === m.id ? null : m.id)}>
                        <I.More />
                      </button>
                      {moreFor === m.id && (
                        <div className="menu" onMouseLeave={() => setMoreFor(null)}>
                          <button
                            onClick={() => {
                              setMoreFor(null);
                              setDislikeFor(m.id);
                              setDislikeText("");
                            }}
                          >
                            <I.Flag size={20} /> {t.report}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      </main>

      {/* Floating scroll button */}
      {!atBottom && messages.length > 0 && (
        <button className="fab" aria-label={t.scrollDown} onClick={() => scrollToBottom()}>
          <I.ArrowDown size={24} />
        </button>
      )}

      {/* Input bar */}
      <footer className="composer-wrap">
        {plusOpen && (
          <div className="plus-menu">
            <button onClick={() => send(t.planTripPrompt)}>
              <I.Plane size={22} /> {t.planTrip}
            </button>
            <button onClick={() => send(t.findUniPrompt)}>
              <I.Cap size={22} /> {t.findUni}
            </button>
            <button onClick={() => send(t.findBizPrompt)}>
              <I.Store size={22} /> {t.findBiz}
            </button>
            <button onClick={() => fileRef.current?.click()}>
              <I.Photo size={22} /> {t.addPhoto}
            </button>
          </div>
        )}
        <div className="composer">
          {image && (
            <div className="preview">
              <img src={image} alt="" />
              <button aria-label="Remove photo" onClick={() => setImage(null)}>
                <I.Close size={14} />
              </button>
            </div>
          )}
          <div className="composer-row">
            <button className={`plus ${plusOpen ? "on" : ""}`} aria-label={t.attach} onClick={() => setPlusOpen((v) => !v)}>
              <I.Plus size={26} />
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              dir="auto"
              value={input}
              placeholder={t.placeholder}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className={`icon-btn mic ${listening ? "live" : ""}`} aria-label={t.mic} onClick={toggleMic}>
              <I.Mic size={24} />
            </button>
            {streaming ? (
              <button className="send active" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                <I.Stop size={20} />
              </button>
            ) : (
              <button className={`send ${canSend ? "active" : ""}`} aria-label={t.send} disabled={!canSend} onClick={() => send()}>
                <I.ArrowUp size={22} />
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
          <button className="icon-btn push" aria-label="Close" onClick={() => setDrawer(false)}>
            <I.Close />
          </button>
        </div>
        <button className="drawer-new" onClick={newChat}>
          <I.NewChat size={22} /> {t.newChat}
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
                <button className="icon-btn sm" aria-label={t.deleteChat} title={t.deleteChat} onClick={() => deleteChat(c.id)}>
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

      {/* Dislike dialog */}
      {dislikeFor && (
        <div className="modal-scrim" onClick={() => setDislikeFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t.whatWrong}>
            <h2>{t.whatWrong}</h2>
            <textarea autoFocus dir="auto" value={dislikeText} onChange={(e) => setDislikeText(e.target.value)} rows={4} />
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDislikeFor(null)}>
                {t.cancel}
              </button>
              <button
                className="btn"
                onClick={() => {
                  const m = messages.find((x) => x.id === dislikeFor);
                  if (m) void sendFeedback(m, "down", dislikeText.trim() || undefined);
                  setDislikeFor(null);
                }}
              >
                {t.send}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
