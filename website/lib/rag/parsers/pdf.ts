import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { extractTextItems, getDocumentProxy } from "unpdf";
import { Unreadable, type Section } from "../types";
import { markdownToSections } from "./markdown";

type Item = { str: string; fontSize: number; y: number; hasEOL: boolean };
type Line = { text: string; size: number };

/**
 * PDF: lines in clearly larger type become headings; without any, one section per page.
 * Running headers/footers, "Page N" lines, dot leaders (contents pages) and rules are removed.
 * A PDF with no text layer (a scan) is Unreadable: it needs OCR, which is not supported yet.
 */
export async function parsePdf(path: string): Promise<Section[]> {
  const name = basename(path);
  let pages: Line[][];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(path)));
    const { items } = await extractTextItems(pdf);
    pages = items.map(itemsToLines);
  } catch (e) {
    throw new Unreadable(name, `cannot open PDF (${e instanceof Error ? e.message : e})`);
  }

  pages = dropNoise(pages);
  const all = pages.flat();
  if (!all.some((l) => /[\p{L}\p{N}]/u.test(l.text))) throw new Unreadable(name, "no text layer (scanned PDF? needs OCR)");

  // Body size = the most common font size; headings are clearly larger and short.
  const counts = new Map<number, number>();
  for (const l of all) counts.set(Math.round(l.size), (counts.get(Math.round(l.size)) ?? 0) + l.text.length);
  const body = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const isHeading = (l: Line) => body > 0 && l.size >= body * 1.25 && l.text.length <= 120;

  if (all.some(isHeading)) {
    const sizes = [...new Set(all.filter(isHeading).map((l) => Math.round(l.size)))].sort((a, b) => b - a);
    const md = all.map((l) => (isHeading(l) ? `${"#".repeat(Math.min(sizes.indexOf(Math.round(l.size)) + 1, 6))} ${l.text}` : l.text)).join("\n");
    return markdownToSections(md, name);
  }
  return pages
    .map((lines, i) => ({ headingPath: [name, `Page ${i + 1}`], text: lines.map((l) => l.text).join("\n").trim() }))
    .filter((s) => s.text);
}

/**
 * Group text pieces into lines by their position on the page. A line's size comes only from pieces
 * with visible text (some PDFs put the next line's font size on an empty end-of-line piece).
 */
export function itemsToLines(page: Item[]): Line[] {
  const lines: Line[] = [];
  let cur: Line & { y: number | null } = { text: "", size: 0, y: null };
  const flush = () => {
    if (cur.text.trim()) lines.push({ text: cur.text.replace(/\s+/g, " ").trim(), size: cur.size });
    cur = { text: "", size: 0, y: null };
  };
  for (const it of page) {
    const visible = it.str.trim() !== "";
    if (visible && cur.y !== null && Math.abs(it.y - cur.y) > 2) flush();
    if (visible) {
      cur.size = Math.max(cur.size, it.fontSize || 0);
      cur.y ??= it.y;
    }
    cur.text += it.str;
    if (it.hasEOL) flush();
  }
  flush();
  return lines;
}

/** Remove lines that repeat on many pages (running headers), page numbers, dot leaders and rules. */
export function dropNoise(pages: Line[][]): Line[][] {
  const seen = new Map<string, number>();
  for (const p of pages) for (const t of new Set(p.map((l) => l.text))) seen.set(t, (seen.get(t) ?? 0) + 1);
  const repeated = (t: string) => pages.length >= 3 && (seen.get(t) ?? 0) >= Math.max(3, pages.length * 0.3);
  return pages.map((p) =>
    p.filter(
      (l) =>
        !repeated(l.text) &&
        !/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(l.text) && // "Page 5", "5", "5 of 25"
        !/(\.\s?){5,}/.test(l.text) && // contents dot leaders
        /[\p{L}\p{N}]/u.test(l.text), // rules like "———"
    ),
  );
}
