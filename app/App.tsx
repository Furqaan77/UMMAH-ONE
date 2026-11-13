import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share as RNShare,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { getLocales } from "expo-localization";
import { fetch as expoFetch } from "expo/fetch";

import * as I from "./src/Icons";
import Answer from "./src/Answer";
import { C, F } from "./src/theme";
import { T, detectLang, type Lang, type LangSetting } from "./src/i18n";
import { API_URL } from "./src/config";
import { speech } from "./src/speech";

type Source = { id: string; title: string; source: string };
type Message = { id: string; role: "user" | "assistant"; content: string; image?: string; sources?: Source[]; error?: boolean; rating?: "up" | "down" };
type ChatT = { id: string; title: string; messages: Message[]; updatedAt: number };

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const CHATS_KEY = "uo.chats";
const LANG_KEY = "uo.lang";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Chat />
    </SafeAreaProvider>
  );
}

function Chat() {
  const [chats, setChats] = useState<ChatT[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [langSetting, setLangSetting] = useState<LangSetting>("auto");
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

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const atBottomRef = useRef(true);

  const deviceLang: Lang = getLocales()[0]?.languageCode === "ar" ? "ar" : "en";
  const uiLang: Lang = langSetting === "auto" ? deviceLang : langSetting;
  const rtl = uiLang === "ar";
  const t = T[uiLang];
  const row = rtl ? ("row-reverse" as const) : ("row" as const);
  const align = rtl ? ("right" as const) : ("left" as const);

  const current = chats.find((c) => c.id === currentId) ?? null;
  const messages = current?.messages ?? [];

  useEffect(() => {
    (async () => {
      try {
        const [c, l] = await Promise.all([AsyncStorage.getItem(CHATS_KEY), AsyncStorage.getItem(LANG_KEY)]);
        if (c) setChats(JSON.parse(c));
        if (l) setLangSetting(JSON.parse(l));
      } catch {
        /* ignore */
      }
      setReady(true);
    })();
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats.map((c) => ({ ...c, messages: c.messages.map(({ image, ...m }) => ({ ...m, image: image ? "attached" : undefined })) })))).catch(() => {});
  }, [chats, ready]);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(LANG_KEY, JSON.stringify(langSetting)).catch(() => {});
  }, [langSetting, ready]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const updateChat = useCallback((id: string, fn: (c: ChatT) => ChatT) => setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c))), []);
  const patchMsg = useCallback(
    (chatId: string, msgId: string, fn: (m: Message) => Message) =>
      updateChat(chatId, (c) => ({ ...c, updatedAt: Date.now(), messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)) })),
    [updateChat],
  );

  async function runAssistant(chatId: string, history: Message[]) {
    const aId = uid();
    updateChat(chatId, (c) => ({ ...c, messages: [...history, { id: aId, role: "assistant", content: "" }] }));
    setStreaming(true);
    atBottomRef.current = true;
    setAtBottom(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await expoFetch(`${API_URL}/api/chat`, {
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
        patchMsg(chatId, aId, (m) => ({
          ...m,
          error: true,
          sources: m.sources ?? [],
          content: uiLang === "ar" ? `تعذر الاتصال بالخادم (${API_URL}).` : `Could not reach the server (${API_URL}). Is the website running?`,
        }));
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
      setChats((cs) => [{ id: chatId!, title: userMsg.content.slice(0, 60), messages: history, updatedAt: Date.now() }, ...cs]);
      setCurrentId(chatId);
    } else history = [...current.messages, userMsg];
    setInput("");
    setImage(null);
    setPlusOpen(false);
    void runAssistant(chatId!, history);
  }

  function retry(msgId: string) {
    if (!current || streaming) return;
    const history = current.messages.slice(0, current.messages.findIndex((m) => m.id === msgId));
    if (history.length && history[history.length - 1].role === "user") void runAssistant(current.id, history);
  }

  function newChat() {
    abortRef.current?.abort();
    setCurrentId(null);
    setDrawer(false);
    setInput("");
    setImage(null);
  }

  async function copy(m: Message) {
    await Clipboard.setStringAsync(m.content);
    setCopied(m.id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function share(m: Message) {
    try {
      await RNShare.share({ message: `${m.content}\n\n— Ummah One` });
    } catch {
      /* cancelled */
    }
  }

  async function sendFeedback(m: Message, rating: "up" | "down", comment?: string) {
    if (!current) return;
    patchMsg(current.id, m.id, (x) => ({ ...x, rating }));
    const idx = current.messages.findIndex((x) => x.id === m.id);
    const question = current.messages.slice(0, idx).reverse().find((x) => x.role === "user")?.content;
    try {
      await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: current.id, messageId: m.id, rating, comment, question, answer: m.content }),
      });
      flash(t.thanks);
    } catch {
      flash("Could not send feedback");
    }
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true, allowsEditing: false });
    if (!r.canceled && r.assets[0]?.base64) {
      setImage(`data:image/jpeg;base64,${r.assets[0].base64}`);
      setPlusOpen(false);
    }
  }

  // Voice input
  useEffect(() => {
    if (!speech) return;
    const subs = [
      speech.addListener("result", (e) => {
        const txt = e.results?.[0]?.transcript ?? "";
        setInput((prev) => (e.isFinal ? (prev.replace(/​.*$/, "") + txt).trim() : prev.replace(/​.*$/, "") + "​" + txt));
      }),
      speech.addListener("end", () => {
        setListening(false);
        setInput((p) => p.replace(/​/g, ""));
      }),
      speech.addListener("error", () => setListening(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  async function toggleMic() {
    if (!speech) return flash(t.micUnsupported);
    if (listening) return speech.stop();
    const p = await speech.requestPermissionsAsync();
    if (!p.granted) return;
    setInput((v) => (v ? v.trimEnd() + " " : ""));
    setListening(true);
    speech.start({ lang: uiLang === "ar" ? "ar-SA" : "en-US", interimResults: true });
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const b = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
    atBottomRef.current = b;
    setAtBottom(b);
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const canSend = (input.trim() !== "" || image !== null) && !streaming;
  const textDir = (s: string) => (detectLang(s) === "ar" ? "right" : "left");

  return (
    <SafeAreaView style={st.app} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Top bar */}
        <View style={[st.topbar, { flexDirection: row }]}>
          <Pressable style={st.iconBtn} onPress={() => setDrawer(true)} accessibilityLabel="Menu" hitSlop={8}>
            <I.Menu size={26} />
          </Pressable>
          <Text style={st.title}>Ummah One</Text>
          <View style={{ flex: 1 }} />
          <Pressable style={st.iconBtn} onPress={newChat} accessibilityLabel={t.newChat} hitSlop={8}>
            <I.NewChat size={26} />
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={st.thread}
          onScroll={onScroll}
          scrollEventThrottle={64}
          onContentSizeChange={() => atBottomRef.current && scrollRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <View style={st.welcome}>
              <Image source={require("./assets/logo-mark.png")} style={{ width: 72, height: 66 }} />
              <Text style={st.welcomeText}>{t.welcome(new Date().getHours())}</Text>
              <Text style={st.note}>{t.disclaimer}</Text>
            </View>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <View key={m.id} style={[st.userRow, { justifyContent: rtl ? "flex-start" : "flex-end" }]}>
                <View style={st.userBubble}>
                  {m.image && m.image !== "attached" && <Image source={{ uri: m.image }} style={st.userImg} />}
                  <Text style={[st.text, { textAlign: textDir(m.content) }]}>{m.content}</Text>
                </View>
              </View>
            ) : (
              <View key={m.id} style={st.ai}>
                {m.sources === undefined && !m.content ? (
                  <View style={[st.meta, { flexDirection: row }]}>
                    <ActivityIndicator size="small" color={C.muted} />
                    <Text style={st.metaText}>{t.thinking}</Text>
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={[st.meta, { flexDirection: row }]}
                      disabled={!m.sources?.length}
                      onPress={() => setOpenSources((o) => ({ ...o, [m.id]: !o[m.id] }))}
                    >
                      <I.Book size={22} color={C.muted} />
                      <Text style={st.metaText}>{m.sources?.length ? t.sources(m.sources.length) : t.noSources}</Text>
                      {!!m.sources?.length && (
                        <View style={{ transform: [{ rotate: openSources[m.id] ? "90deg" : rtl ? "180deg" : "0deg" }] }}>
                          <I.Chevron size={18} color={C.muted} />
                        </View>
                      )}
                    </Pressable>
                    {openSources[m.id] && m.sources && (
                      <View style={st.sources}>
                        {m.sources.map((s, i) => (
                          <View key={s.id} style={{ marginTop: i ? 8 : 0 }}>
                            <Text style={[st.srcTitle, { textAlign: align }]}>{`${i + 1}. ${s.title}`}</Text>
                            <Text style={[st.srcText, { textAlign: align }]}>{s.source}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <Answer text={m.content + (streaming && m.id === lastAssistantId ? " ▍" : "")} rtl={detectLang(m.content) === "ar"} color={m.error ? C.danger : C.text} />

                {!(streaming && m.id === lastAssistantId) && !!m.content && (
                  <View style={[st.actions, { flexDirection: row }]}>
                    <Pressable style={st.actBtn} onPress={() => copy(m)} accessibilityLabel={t.copy}>
                      {copied === m.id ? <I.Check size={23} /> : <I.Copy size={23} />}
                    </Pressable>
                    <Pressable style={[st.actBtn, m.rating === "up" && st.on]} onPress={() => sendFeedback(m, "up")} accessibilityLabel={t.like}>
                      <I.ThumbUp size={23} color={m.rating === "up" ? C.accent : C.icon} />
                    </Pressable>
                    <Pressable
                      style={[st.actBtn, m.rating === "down" && st.on]}
                      onPress={() => {
                        setDislikeFor(m.id);
                        setDislikeText("");
                      }}
                      accessibilityLabel={t.dislike}
                    >
                      <I.ThumbDown size={23} />
                    </Pressable>
                    <Pressable style={st.actBtn} onPress={() => share(m)} accessibilityLabel={t.share}>
                      <I.Share size={23} />
                    </Pressable>
                    <Pressable style={st.actBtn} onPress={() => retry(m.id)} accessibilityLabel={t.retry}>
                      <I.Retry size={23} />
                    </Pressable>
                    <Pressable style={st.actBtn} onPress={() => setMoreFor(m.id)} accessibilityLabel={t.more}>
                      <I.More size={23} />
                    </Pressable>
                  </View>
                )}
              </View>
            ),
          )}
        </ScrollView>

        {!atBottom && messages.length > 0 && (
          <Pressable style={[st.fab, rtl ? { left: 22 } : { right: 22 }]} onPress={() => scrollRef.current?.scrollToEnd({ animated: true })} accessibilityLabel={t.scrollDown}>
            <I.ArrowDown size={24} />
          </Pressable>
        )}

        {/* Composer */}
        <View style={st.composerWrap}>
          {plusOpen && (
            <View style={[st.popover, rtl ? { right: 16 } : { left: 16 }]}>
              {[
                { icon: <I.Plane size={22} />, label: t.planTrip, on: () => send(t.planTripPrompt) },
                { icon: <I.Cap size={22} />, label: t.findUni, on: () => send(t.findUniPrompt) },
                { icon: <I.Store size={22} />, label: t.findBiz, on: () => send(t.findBizPrompt) },
                { icon: <I.Photo size={22} />, label: t.addPhoto, on: pickPhoto },
              ].map((o) => (
                <Pressable key={o.label} style={({ pressed }) => [st.popItem, { flexDirection: row }, pressed && { backgroundColor: C.soft }]} onPress={o.on}>
                  {o.icon}
                  <Text style={st.popText}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={st.composer}>
            {image && (
              <View style={st.preview}>
                <Image source={{ uri: image }} style={st.previewImg} />
                <Pressable style={st.previewX} onPress={() => setImage(null)} accessibilityLabel="Remove photo">
                  <I.Close size={14} color="#fff" />
                </Pressable>
              </View>
            )}
            <View style={[st.composerRow, { flexDirection: row }]}>
              <Pressable style={[st.plus, plusOpen && { transform: [{ rotate: "45deg" }] }]} onPress={() => setPlusOpen((v) => !v)} accessibilityLabel={t.attach}>
                <I.Plus size={26} />
              </Pressable>
              <TextInput
                style={[st.input, { textAlign: input ? textDir(input) : align }]}
                value={input}
                onChangeText={setInput}
                placeholder={t.placeholder}
                placeholderTextColor={C.placeholder}
                multiline
                numberOfLines={1}
              />
              <Pressable style={st.mic} onPress={toggleMic} accessibilityLabel={t.mic}>
                <I.Mic size={24} color={listening ? C.danger : "#555"} />
              </Pressable>
              {streaming ? (
                <Pressable style={[st.send, { backgroundColor: C.accent }]} onPress={() => abortRef.current?.abort()} accessibilityLabel="Stop">
                  <I.Stop />
                </Pressable>
              ) : (
                <Pressable style={[st.send, canSend && { backgroundColor: C.accent }]} disabled={!canSend} onPress={() => send()} accessibilityLabel={t.send}>
                  <I.ArrowUp size={22} color="#fff" />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Drawer */}
      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <View style={{ flex: 1, flexDirection: row }}>
          <SafeAreaView style={st.drawer} edges={["top", "bottom"]}>
            <View style={[st.drawerHead, { flexDirection: row }]}>
              <Image source={require("./assets/logo-mark.png")} style={{ width: 30, height: 28 }} />
              <Text style={st.drawerTitle}>Ummah One</Text>
              <View style={{ flex: 1 }} />
              <Pressable style={st.iconBtn} onPress={() => setDrawer(false)} accessibilityLabel="Close">
                <I.Close />
              </Pressable>
            </View>
            <Pressable style={[st.drawerNew, { flexDirection: row }]} onPress={newChat}>
              <I.NewChat size={22} />
              <Text style={st.drawerNewText}>{t.newChat}</Text>
            </Pressable>
            <Text style={[st.label, { textAlign: align }]}>{t.history}</Text>
            <ScrollView style={{ flex: 1 }}>
              {chats.length === 0 && <Text style={[st.empty, { textAlign: align }]}>{t.noHistory}</Text>}
              {[...chats]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((c) => (
                  <View key={c.id} style={[st.drawerItem, { flexDirection: row }, c.id === currentId && { backgroundColor: C.soft }]}>
                    <Pressable
                      style={{ flex: 1, padding: 10 }}
                      onPress={() => {
                        setCurrentId(c.id);
                        setDrawer(false);
                      }}
                    >
                      <Text numberOfLines={1} style={[st.drawerItemText, { textAlign: textDir(c.title) }]}>{c.title}</Text>
                    </Pressable>
                    <Pressable
                      style={st.actBtn}
                      onPress={() => {
                        setChats((cs) => cs.filter((x) => x.id !== c.id));
                        if (c.id === currentId) setCurrentId(null);
                      }}
                      accessibilityLabel={t.deleteChat}
                    >
                      <I.Trash size={18} />
                    </Pressable>
                  </View>
                ))}
            </ScrollView>
            <View style={st.drawerFoot}>
              <Text style={[st.label, { textAlign: align }]}>{t.language}</Text>
              <View style={[st.seg, { flexDirection: row }]}>
                {(["auto", "en", "ar"] as const).map((l) => (
                  <Pressable key={l} style={[st.segBtn, langSetting === l && st.segOn]} onPress={() => setLangSetting(l)}>
                    <Text style={[st.segText, langSetting === l && { color: C.text, fontWeight: "600" }]}>{l === "auto" ? t.auto : l === "en" ? "English" : "العربية"}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[st.drawerNote, { textAlign: align }]}>{t.historyNote}</Text>
            </View>
          </SafeAreaView>
          <Pressable style={st.scrim} onPress={() => setDrawer(false)} />
        </View>
      </Modal>

      {/* More menu */}
      <Modal visible={!!moreFor} transparent animationType="fade" onRequestClose={() => setMoreFor(null)}>
        <Pressable style={st.sheetScrim} onPress={() => setMoreFor(null)}>
          <View style={st.sheet}>
            <Pressable
              style={[st.popItem, { flexDirection: row }]}
              onPress={() => {
                const id = moreFor;
                setMoreFor(null);
                setDislikeFor(id);
                setDislikeText("");
              }}
            >
              <I.Flag size={22} />
              <Text style={st.popText}>{t.report}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Dislike dialog */}
      <Modal visible={!!dislikeFor} transparent animationType="fade" onRequestClose={() => setDislikeFor(null)}>
        <KeyboardAvoidingView style={st.modalScrim} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={st.modal}>
            <Text style={[st.modalTitle, { textAlign: align }]}>{t.whatWrong}</Text>
            <TextInput style={[st.modalInput, { textAlign: align }]} value={dislikeText} onChangeText={setDislikeText} multiline autoFocus />
            <View style={[st.modalActions, { flexDirection: row }]}>
              <Pressable style={[st.btn, st.btnGhost]} onPress={() => setDislikeFor(null)}>
                <Text style={[st.btnText, { color: C.text }]}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                style={st.btn}
                onPress={() => {
                  const m = messages.find((x) => x.id === dislikeFor);
                  if (m) void sendFeedback(m, "down", dislikeText.trim() || undefined);
                  setDislikeFor(null);
                }}
              >
                <Text style={st.btnText}>{t.send}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast && (
        <View style={st.toast} pointerEvents="none">
          <Text style={st.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  text: { fontSize: F.size, lineHeight: F.lineHeight, fontWeight: F.weight, color: C.text },
  topbar: { alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: F.title, fontWeight: "700", color: C.text },
  thread: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },

  welcome: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 60 },
  welcomeText: { fontSize: 21, fontWeight: "600", color: C.text, textAlign: "center" },
  note: { fontSize: 13.5, color: C.muted, textAlign: "center" },

  userRow: { flexDirection: "row", marginTop: 16, marginBottom: 24 },
  userBubble: { maxWidth: "86%", backgroundColor: C.soft, borderRadius: 22, paddingVertical: 13, paddingHorizontal: 20 },
  userImg: { width: 200, height: 150, borderRadius: 14, marginBottom: 10 },

  ai: { marginBottom: 24 },
  meta: { alignItems: "center", gap: 10, marginTop: 4, marginBottom: 12, alignSelf: "flex-start" },
  metaText: { fontSize: F.size, color: C.muted, fontWeight: "500" },
  sources: { backgroundColor: C.soft, borderRadius: 16, padding: 14, marginBottom: 14 },
  srcTitle: { fontSize: 15, fontWeight: "600", color: C.text },
  srcText: { fontSize: 14, color: C.muted, marginTop: 2 },
  actions: { alignItems: "center", gap: 10, marginTop: 2, marginLeft: -8 },
  actBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  on: { backgroundColor: C.soft },

  fab: {
    position: "absolute", bottom: 100, width: 48, height: 48, borderRadius: 24, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  composerWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  composer: { backgroundColor: C.soft, borderRadius: 28, padding: 7 },
  composerRow: { alignItems: "flex-end", gap: 4 },
  plus: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.bg, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  input: { flex: 1, fontSize: F.size, color: C.text, maxHeight: 140, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 12 },
  mic: { width: 40, height: 46, alignItems: "center", justifyContent: "center" },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.sendOff, alignItems: "center", justifyContent: "center" },
  preview: { margin: 6, marginBottom: 4, alignSelf: "flex-start" },
  previewImg: { width: 72, height: 72, borderRadius: 14 },
  previewX: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },

  popover: {
    position: "absolute", bottom: "100%", zIndex: 10, minWidth: 250, backgroundColor: C.bg, borderRadius: 18, padding: 8,
    borderWidth: 1, borderColor: C.line, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  popItem: { alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  popText: { fontSize: 17, color: C.text, fontWeight: "500" },

  drawer: { width: "84%", maxWidth: 330, backgroundColor: C.bg, paddingHorizontal: 14 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  drawerHead: { alignItems: "center", gap: 10, paddingVertical: 8 },
  drawerTitle: { fontSize: 20, fontWeight: "700", color: C.text },
  drawerNew: { alignItems: "center", gap: 12, padding: 12, borderRadius: 14, backgroundColor: C.soft, marginTop: 6 },
  drawerNewText: { fontSize: 17, fontWeight: "600", color: C.text },
  label: { fontSize: 12.5, letterSpacing: 0.8, color: C.muted, fontWeight: "600", paddingTop: 18, paddingBottom: 6, paddingHorizontal: 8, textTransform: "uppercase" },
  empty: { padding: 8, color: C.muted, fontSize: 16 },
  drawerItem: { alignItems: "center", borderRadius: 12 },
  drawerItemText: { fontSize: 16, color: C.text },
  drawerFoot: { borderTopWidth: 1, borderTopColor: C.line, paddingBottom: 8 },
  seg: { backgroundColor: C.soft, borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  segOn: { backgroundColor: C.bg, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 15, color: C.muted },
  drawerNote: { fontSize: 13, color: C.muted, marginTop: 10, marginHorizontal: 4, lineHeight: 18 },

  sheetScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 12, paddingBottom: 34 },

  modalScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: C.bg, borderRadius: 22, padding: 22, width: "100%", maxWidth: 440 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: C.text, marginBottom: 12 },
  modalInput: { minHeight: 100, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, fontSize: 16, backgroundColor: C.soft, textAlignVertical: "top" },
  modalActions: { justifyContent: "flex-end", gap: 10, marginTop: 14 },
  btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, backgroundColor: C.accent },
  btnGhost: { backgroundColor: C.soft },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },

  toast: { position: "absolute", bottom: 110, alignSelf: "center", backgroundColor: C.accent, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  toastText: { color: "#fff", fontSize: 15 },
});
