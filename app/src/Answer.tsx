import { Text, View, StyleSheet } from "react-native";
import { C, F } from "./theme";

// Paragraphs, "- " bullets, "1. " lists, **bold**. Same rules as the website renderer.

function inline(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <Text key={`${keyBase}-${i}`} style={s.bold}>{p.slice(2, -2)}</Text>
    ) : (
      <Text key={`${keyBase}-${i}`}>{p}</Text>
    ),
  );
}

export default function Answer({ text, color = C.text, rtl }: { text: string; color?: string; rtl: boolean }) {
  const align = { textAlign: rtl ? ("right" as const) : ("left" as const), writingDirection: rtl ? ("rtl" as const) : ("ltr" as const) };
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <View>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (!lines.length) return null;
        const bullets = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const numbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (bullets || numbered)
          return (
            <View key={bi} style={s.block}>
              {lines.map((l, i) => (
                <View key={i} style={[s.li, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                  <Text style={[s.text, { color }]}>{bullets ? "•" : `${i + 1}.`}</Text>
                  <Text style={[s.text, s.liText, align, { color }]}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), `${bi}-${i}`)}</Text>
                </View>
              ))}
            </View>
          );
        const heading = lines.length === 1 && /^#{1,4}\s+/.test(lines[0]);
        return (
          <Text key={bi} style={[s.text, s.block, align, heading && s.h, { color }]}>
            {inline((heading ? lines[0].replace(/^#{1,4}\s+/, "") : lines.join("\n")), String(bi))}
          </Text>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  text: { fontSize: F.size, lineHeight: F.lineHeight, fontWeight: F.weight, color: C.text },
  block: { marginBottom: 14 },
  bold: { fontWeight: "700" },
  h: { fontSize: 19, fontWeight: "700" },
  li: { gap: 8, marginBottom: 4 },
  liText: { flex: 1 },
});
