import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { extractTextItems, getDocumentProxy } from "unpdf";
import { Unreadable, type Section } from "../types";
import { markdownToSections } from "./markdown";

/**
 * PDF: lines in clearly larger type become headings; without any, one section per page.
 * A PDF with no text layer (a scan) is Unreadable: it needs OCR, which is not supported yet.
 */
export async function parsePdf(path: string): Promise<Section[]> {
  const name = basename(path);
  let pages: { text: string; size: number }[][];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(path)));
    const { items } = await extractTextItems(pdf);
    pages = items.map((page) => {
      const lines: { text: string; size: number }[] = [];
      let cur = { text: "", size: 0 };
      for (const it of page) {
        cur.text += it.str;
        cur.size = Math.max(cur.size, it.fontSize || 0);
        if (it.hasEOL) {
          if (cur.text.trim()) lines.push({ text: cur.text.trim(), size: cur.size });
          cur = { text: "", size: 0 };
        }
      }
      if (cur.text.trim()) lines.push({ text: cur.text.trim(), size: cur.size });
      return lines;
    });
  } catch (e) {
    throw new Unreadable(name, `cannot open PDF (${e instanceof Error ? e.message : e})`);
  }

  const all = pages.flat();
  if (!all.some((l) => /[\p{L}\p{N}]/u.test(l.text))) throw new Unreadable(name, "no text layer (scanned PDF? needs OCR)");

  // Body size = the most common font size; headings are clearly larger and short.
  const counts = new Map<number, number>();
  for (const l of all) counts.set(Math.round(l.size), (counts.get(Math.round(l.size)) ?? 0) + l.text.length);
  const body = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const isHeading = (l: { text: string; size: number }) => body > 0 && l.size >= body * 1.25 && l.text.length <= 120;

  if (all.some(isHeading)) {
    const sizes = [...new Set(all.filter(isHeading).map((l) => Math.round(l.size)))].sort((a, b) => b - a);
    const md = all.map((l) => (isHeading(l) ? `${"#".repeat(Math.min(sizes.indexOf(Math.round(l.size)) + 1, 6))} ${l.text}` : l.text)).join("\n");
    return markdownToSections(md, name);
  }
  return pages
    .map((lines, i) => ({ headingPath: [name, `Page ${i + 1}`], text: lines.map((l) => l.text).join("\n").trim() }))
    .filter((s) => s.text);
}
