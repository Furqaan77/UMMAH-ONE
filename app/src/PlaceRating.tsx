import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C } from "./theme";
import { API_URL } from "./config";
import { LABELS, LABEL_NAMES, LIMITS, isLabel, type EnjoymentLabel } from "./limits";
import type { Lang, Strings } from "./i18n";

const DEVICE_KEY = "uo.device";
const RATED_KEY = "uo.rated";
let memoryId = ""; // used when storage fails, so one session keeps one id

const newId = () => (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 32);

async function deviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_KEY);
    if (!id || !/^[a-z0-9]{8,40}$/i.test(id)) {
      id = newId();
      await AsyncStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    memoryId ||= newId();
    return memoryId;
  }
}

async function loadRated(): Promise<Record<string, EnjoymentLabel>> {
  try {
    const o: unknown = JSON.parse((await AsyncStorage.getItem(RATED_KEY)) ?? "{}");
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o).filter(([, l]) => isLabel(l))) as Record<string, EnjoymentLabel>;
  } catch {
    return {};
  }
}

/** Under an answer about one travel city: the team's approved label (if any) and the visitor rating box. */
export default function PlaceRating({ city, label, lang, t, flash, rtl }: { city: string; label: EnjoymentLabel | null; lang: Lang; t: Strings; flash: (m: string) => void; rtl: boolean }) {
  const [rated, setRated] = useState<EnjoymentLabel | null>(null);
  const [editing, setEditing] = useState(false);
  const [visited, setVisited] = useState(false);
  const [choice, setChoice] = useState<EnjoymentLabel | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const names = LABEL_NAMES[lang];
  const row = rtl ? ("row-reverse" as const) : ("row" as const);
  const align = rtl ? ("right" as const) : ("left" as const);

  useEffect(() => {
    let live = true;
    void loadRated().then((r) => live && setRated(r[city] ?? null));
    return () => {
      live = false;
    };
  }, [city]);

  async function submit() {
    if (!visited || !choice || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/place-rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: await deviceId(), city, label: choice, visited, comment: comment.trim() || undefined }),
      });
      if (res.status === 429) return flash(t.tooManyRatings);
      if (!res.ok) throw new Error(String(res.status));
      try {
        await AsyncStorage.setItem(RATED_KEY, JSON.stringify({ ...(await loadRated()), [city]: choice }));
      } catch {
        /* ignore */
      }
      setRated(choice);
      setEditing(false);
      flash(t.thanks);
    } catch {
      flash(t.rateError);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={s.wrap}>
      {label && (
        <View style={[s.badge, { alignSelf: rtl ? "flex-end" : "flex-start" }]}>
          <Text style={s.badgeText}>{t.ratingBadge(names[label])}</Text>
        </View>
      )}
      {rated && !editing ? (
        <View style={[s.done, { flexDirection: row }]}>
          <Text style={[s.muted, { textAlign: align, flexShrink: 1 }]}>{t.youRated(city, names[rated])}</Text>
          <Pressable onPress={() => { setEditing(true); setVisited(false); setChoice(rated); setComment(""); }} accessibilityRole="button">
            <Text style={s.link}>{t.rateChange}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.box}>
          <View style={{ flexDirection: row, justifyContent: "space-between", gap: 10 }}>
            <Text style={[s.q, { textAlign: align, flexShrink: 1 }]}>{t.rateQ(city)}</Text>
            {editing && rated && (
              <Pressable onPress={() => setEditing(false)} accessibilityRole="button">
                <Text style={s.link}>{t.cancel}</Text>
              </Pressable>
            )}
          </View>
          <Pressable style={[s.visited, { flexDirection: row }]} onPress={() => setVisited((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: visited }}>
            <View style={[s.check, visited && s.checkOn]}>{visited && <Text style={s.tick}>✓</Text>}</View>
            <Text style={[s.text, { flexShrink: 1 }]}>{t.visited(city)}</Text>
          </Pressable>
          <View style={[s.chips, { flexDirection: row }]}>
            {LABELS.map((l) => (
              <Pressable key={l} disabled={!visited} onPress={() => setChoice(l)} style={[s.chip, choice === l && s.chipOn, !visited && s.chipOff]} accessibilityRole="button" accessibilityState={{ selected: choice === l, disabled: !visited }}>
                <Text style={[s.chipText, choice === l && s.chipTextOn]}>{names[l]}</Text>
              </Pressable>
            ))}
          </View>
          {visited && choice ? (
            <>
              <TextInput style={[s.comment, { textAlign: align }]} value={comment} onChangeText={setComment} placeholder={t.rateComment} placeholderTextColor={C.placeholder} multiline maxLength={LIMITS.commentChars} />
              <Text style={[s.muted, { textAlign: align }]}>{t.rateCommentNote}</Text>
              <View style={{ flexDirection: row, justifyContent: "flex-end" }}>
                <Pressable style={[s.chip, s.chipOn, sending && s.chipOff]} onPress={submit} disabled={sending} accessibilityRole="button" accessibilityState={{ disabled: sending, busy: sending }}>
                  <Text style={[s.chipText, s.chipTextOn]}>{t.send}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            !visited && <Text style={[s.muted, { textAlign: align }]}>{t.rateNeedVisit}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 10, gap: 10 },
  badge: { backgroundColor: C.soft, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  badgeText: { fontSize: 15, fontWeight: "600", color: C.text },
  box: { borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, gap: 10 },
  q: { fontSize: 15.5, fontWeight: "600", color: C.text },
  visited: { alignItems: "center", gap: 8 },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.muted, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: C.accent, borderColor: C.accent },
  tick: { color: "#fff", fontSize: 13, fontWeight: "700" },
  text: { fontSize: 15, color: C.text },
  chips: { flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: C.bg },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipOff: { opacity: 0.45 },
  chipText: { fontSize: 15, color: C.text },
  chipTextOn: { color: C.bg },
  comment: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, minHeight: 60, fontSize: 15, color: C.text },
  muted: { fontSize: 14, color: C.muted },
  done: { alignItems: "center", gap: 10, flexWrap: "wrap" },
  link: { fontSize: 15, color: C.text, textDecorationLine: "underline" },
});
