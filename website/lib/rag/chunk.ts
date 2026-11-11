import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import { findBlocked, fold } from "./blocked";
import { parseMarkdown, parseText } from "./parsers/markdown";
import { BlockedPlaceError, type Chunk, type ChunkMeta, type FileMeta, type Section } from "./types";

export const MAX_CHARS = 1200;

/** File type → parser. Story 1.3 adds pdf, docx, xlsx, csv here. */
export const PARSERS: Record<string, (path: string) => Section[]> = {
  ".md": parseMarkdown,
  ".markdown": parseMarkdown,
  ".txt": parseText,
};

export type ChunkResult = { chunks: Chunk[]; warnings: string[] };

/** All supported files under dataDir/<category>/… → chunks. Throws on a blocked place or an unreadable file. */
export function chunkAll(dataDir: string): ChunkResult {
  return walk(dataDir, (dir, path) => chunkFile(dir, path));
}

export type DetailedResult = ChunkResult & {
  files: string[]; // "category/file" of every file that produced chunks
  unreadable: string[]; // messages
  unreadableFiles: string[]; // "category/file"
  blocked: string[]; // messages
};

/** Like chunkAll, but keeps going: per-file problems are collected instead of thrown. */
export function chunkAllDetailed(dataDir: string): DetailedResult {
  const files: string[] = [];
  const unreadable: string[] = [];
  const unreadableFiles: string[] = [];
  const blocked: string[] = [];
  const r = walk(dataDir, (dir, path) => {
    const key = relative(dir, path).split(sep).join("/");
    try {
      const out = chunkFile(dir, path);
      files.push(key);
      return out;
    } catch (e) {
      if (e instanceof BlockedPlaceError) blocked.push(e.message);
      else {
        unreadable.push(`${key}: ${e instanceof Error ? e.message.replace(/^[^:]+: /, "") : String(e)}`);
        unreadableFiles.push(key);
      }
      return { chunks: [], warnings: [] };
    }
  });
  return { ...r, files, unreadable, unreadableFiles, blocked };
}

function walk(dataDir: string, each: (dataDir: string, path: string) => ChunkResult): ChunkResult {
  const chunks: Chunk[] = [];
  const warnings: string[] = [];
  for (const path of listFiles(dataDir)) {
    const rel = relative(dataDir, path);
    if (!rel.includes(sep)) {
      warnings.push(`${rel}: file must be inside a category folder (e.g. data/travel/) — skipped`);
      continue;
    }
    if (!PARSERS[extname(path).toLowerCase()]) {
      warnings.push(`${rel}: file type not supported yet — skipped`);
      continue;
    }
    const r = each(dataDir, path);
    chunks.push(...r.chunks);
    warnings.push(...r.warnings);
  }
  return { chunks, warnings };
}

export function chunkFile(dataDir: string, path: string): ChunkResult {
  const file = basename(path);
  const category = relative(dataDir, path).split(sep)[0];
  const parse = PARSERS[extname(path).toLowerCase()];
  const fileMeta = readFileMeta(path);
  const sections = parse(path);
  const warnings: string[] = [];

  // A blocked place in any heading stops the whole file (AD-8).
  for (const s of sections)
    for (const h of s.headingPath) {
      const hit = findBlocked(h);
      if (hit.length) throw new BlockedPlaceError(file, hit[0], h);
    }

  const chunks: Chunk[] = [];
  const used = new Set<string>();
  for (const s of sections) {
    const meta = placeMeta(s.headingPath, fileMeta);
    const title = itemHeading(s.headingPath) ?? s.headingPath[s.headingPath.length - 1];
    const section = s.headingPath[s.headingPath.length - 1];
    const mentioned = findBlocked(s.text);
    if (mentioned.length) warnings.push(`${file} › ${section}: mentions blocked place ${mentioned.join(", ")} — check the text`);

    const parts = split(s.text, MAX_CHARS);
    const baseId = `${category}/${file}#${slug(s.headingPath.join(" "))}`;
    parts.forEach((text, i) => {
      let id = i === 0 ? baseId : `${baseId}-${i + 1}`;
      for (let n = 2; used.has(id); n++) id = `${baseId}-${i + 1}-${n}`;
      used.add(id);
      chunks.push({
        id,
        category,
        file,
        title,
        section,
        text,
        meta,
        source: `${file} › ${section} — to verify`,
        hash: sha256(JSON.stringify([category, file, title, section, text, meta])),
      });
    });
  }
  return { chunks, warnings };
}

/** "## City, Country" is the item. Without one, there is no item heading. */
function itemHeading(path: string[]): string | undefined {
  return path.length >= 2 ? path[1] : undefined;
}

/** Region from "# Region — subtitle", city and country from "## City, Country"; meta.json overrides (AD-3). */
function placeMeta(path: string[], fm: FileMeta): ChunkMeta {
  const meta: ChunkMeta = {};
  if (fm.placeHeadings !== false && path.length >= 2) {
    const region = path[0].split(" — ")[0].trim();
    const m = /^(.+),\s*([^,]+)$/.exec(path[1]);
    if (m) {
      if (fm.regionFromHeading !== false) meta.region = region;
      meta.city = m[1].trim();
      meta.country = m[2].trim();
    }
  }
  for (const k of ["region", "country", "city"] as const) if (fm[k]) meta[k] = fm[k];
  return meta;
}

function readFileMeta(path: string): FileMeta {
  const p = path.slice(0, -extname(path).length) + ".meta.json";
  const alt = `${path}.meta.json`;
  const f = existsSync(alt) ? alt : existsSync(p) ? p : null;
  if (!f) return {};
  try {
    return JSON.parse(readFileSync(f, "utf8")) as FileMeta;
  } catch (e) {
    throw new Error(`${basename(f)}: not valid JSON (${(e as Error).message})`);
  }
}

/** Split long text at paragraph breaks, then at line breaks, keeping parts under max. */
export function split(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const pieces = text
    .split(/\n\s*\n/)
    .flatMap((p) => (p.length > max ? p.split("\n") : [p]))
    .flatMap((p) => (p.length > max ? splitLong(p, max) : [p]));
  const out: string[] = [];
  let cur = "";
  for (const p of pieces) {
    const sepr = cur ? (cur.includes("\n") || /^\s*(\d+\.|[-*])\s/.test(p) ? "\n" : "\n\n") : "";
    if (cur && cur.length + sepr.length + p.length > max) {
      out.push(cur.trim());
      cur = p;
    } else cur += sepr + p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A single line longer than max: cut at sentence ends, else at spaces, else hard. */
function splitLong(line: string, max: number): string[] {
  const out: string[] = [];
  let rest = line;
  while (rest.length > max) {
    const win = rest.slice(0, max);
    let cut = Math.max(win.lastIndexOf(". "), win.lastIndexOf("? "), win.lastIndexOf("! "));
    cut = cut > max / 2 ? cut + 1 : win.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export function slug(s: string): string {
  return fold(s).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".") || name.endsWith(".meta.json")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}
