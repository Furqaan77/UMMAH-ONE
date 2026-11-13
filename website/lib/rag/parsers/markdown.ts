import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Unreadable, type Section } from "../types";

/** Markdown: one section per heading, with the full heading path. Text before the first heading goes under the file name. */
export function parseMarkdown(path: string): Section[] {
  return markdownToSections(readFileSync(path, "utf8"), basename(path));
}

export function markdownToSections(md: string, fileName: string): Section[] {
  const out: Section[] = [];
  const stack: { level: number; text: string }[] = [];
  let buf: string[] = [];

  const flush = () => {
    const text = clean(buf.join("\n"));
    if (text) out.push({ headingPath: stack.length ? stack.map((h) => h.text) : [fileName], text });
    buf = [];
  };

  for (const line of md.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      flush();
      const level = m[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, text: clean(m[2]) });
    } else {
      buf.push(line);
    }
  }
  flush();
  // A file of headings only still has no readable text.
  if (!out.length) throw new Unreadable(fileName);
  return out;
}

/** Plain text: one section per blank-line-separated block, under the file name. */
export function parseText(path: string): Section[] {
  const name = basename(path);
  const blocks = readFileSync(path, "utf8").split(/\r?\n\s*\r?\n/).map(clean).filter(Boolean);
  if (!blocks.length) throw new Unreadable(name);
  return blocks.map((text) => ({ headingPath: [name], text }));
}

function clean(s: string): string {
  return s
    .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, "") // horizontal rules
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
