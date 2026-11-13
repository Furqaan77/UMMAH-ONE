import { basename } from "node:path";
import mammoth from "mammoth";
import { Unreadable, type Section } from "../types";
import { markdownToSections } from "./markdown";

/** Word (.docx): Word headings become sections; paragraphs, lists and tables become text. */
export async function parseDocx(path: string): Promise<Section[]> {
  const name = basename(path);
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ path })).value;
  } catch (e) {
    throw new Unreadable(name, `cannot open Word file (${e instanceof Error ? e.message : e})`);
  }
  return markdownToSections(htmlToMarkdown(html), name);
}

export function htmlToMarkdown(html: string): string {
  // Many Word files use short all-bold lines instead of heading styles: treat those as headings,
  // but only when the file has no real headings.
  if (!/<h[1-6][\s>]/i.test(html)) html = html.replace(/<p>\s*<strong>([^<]{1,120})<\/strong>\s*<\/p>/gi, "<h2>$1</h2>");
  return decode(
    html
      .replace(/<p>\s*[•·▪◦]\s*/gi, "<p>- ")
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n${"#".repeat(Number(n))} ${strip(t)}\n`)
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${strip(t)}`)
      .replace(/<\/(td|th)>/gi, " | ")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|ul|ol|table)>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function strip(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}
