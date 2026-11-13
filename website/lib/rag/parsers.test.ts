import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { chunkAllDetailed } from "./chunk";
import { Unreadable } from "./types";
import { parsePdf } from "./parsers/pdf";
import { parseDocx } from "./parsers/docx";
import { parseCsv, parseXlsx } from "./parsers/table";

const FIX = join(process.cwd(), "lib", "rag", "fixtures");

async function makeXlsx(path: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Shops");
  ws.addRow(["Name", "City", "Country", "Sells"]);
  ws.addRow(["Al Fahidi Perfumes", "Dubai", "UAE", "Oud and attar"]);
  ws.addRow(["Grand Bazaar Carpets", "Istanbul", "Türkiye", { richText: [{ text: "Hand-knotted " }, { text: "carpets" }] }]);
  wb.addWorksheet("Empty");
  await wb.xlsx.writeFile(path);
}

test("PDF: larger lines become headings", async () => {
  const s = await parsePdf(join(FIX, "heritage.pdf"));
  assert.deepEqual(s.map((x) => x.headingPath.at(-1)), ["Heritage of Bukhara", "Heritage of Khiva"]);
  assert.match(s[0].text, /Kalyan Minaret has stood since 1127/);
});

test("PDF without headings: one section per page", async () => {
  const s = await parsePdf(join(FIX, "plain.pdf"));
  assert.deepEqual(s.map((x) => x.headingPath), [["plain.pdf", "Page 1"], ["plain.pdf", "Page 2"]]);
  assert.match(s[1].text, /Mostar/);
});

test("scanned PDF (no text layer) is unreadable", async () => {
  await assert.rejects(parsePdf(join(FIX, "scanned.pdf")), (e) => e instanceof Unreadable && /needs OCR/.test(e.message));
});

test("broken PDF is unreadable", async () => {
  const p = join(mkdtempSync(join(tmpdir(), "p-")), "bad.pdf");
  writeFileSync(p, "not a pdf");
  await assert.rejects(parsePdf(p), Unreadable);
});

test("Word: headings, paragraphs and lists", async () => {
  const s = await parseDocx(join(FIX, "food.docx"));
  const kebab = s.find((x) => x.headingPath.at(-1) === "Kebab, Türkiye")!;
  assert.ok(kebab, JSON.stringify(s.map((x) => x.headingPath)));
  assert.match(kebab.text, /halal everywhere/);
  assert.match(kebab.text, /- Adana kebab/);
  assert.ok(s.some((x) => x.headingPath.at(-1) === "Plov, Uzbekistan"));
});

test("Word: real heading styles are used when present", async () => {
  const { htmlToMarkdown } = await import("./parsers/docx");
  const md = htmlToMarkdown("<h1>Guide</h1><p><strong>Not a heading here</strong></p><h2>Dates &amp; coffee</h2><p>Text.</p>");
  assert.deepEqual(md.split("\n").filter(Boolean), ["# Guide", "Not a heading here", "## Dates & coffee", "Text."]);
});

test("broken Word file is unreadable", async () => {
  const p = join(mkdtempSync(join(tmpdir(), "d-")), "bad.docx");
  writeFileSync(p, "not a zip");
  await assert.rejects(parseDocx(p), Unreadable);
});

test("Excel: one section per row, column names kept, City/Country set the place", async () => {
  const p = join(mkdtempSync(join(tmpdir(), "x-")), "shops.xlsx");
  await makeXlsx(p);
  const s = await parseXlsx(p);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0].headingPath, ["shops.xlsx", "Al Fahidi Perfumes"]);
  assert.match(s[0].text, /Sells: Oud and attar/);
  assert.deepEqual(s[0].meta, { city: "Dubai", country: "UAE" });
  assert.match(s[1].text, /Sells: Hand-knotted carpets/);
});

test("CSV: rows with header names, empty rows skipped", () => {
  const s = parseCsv(join(FIX, "crafts.csv"));
  assert.equal(s.length, 2);
  assert.equal(s[0].headingPath[1], "Iznik Tiles Workshop");
  assert.match(s[0].text, /Craft: Hand-painted tiles/);
  assert.deepEqual(s[1].meta, { city: "Samarkand", country: "Uzbekistan" });
});

test("header-only CSV is unreadable", () => {
  const p = join(mkdtempSync(join(tmpdir(), "c-")), "h.csv");
  writeFileSync(p, "Name,City\n");
  assert.throws(() => parseCsv(p), Unreadable);
});

test("ingest-level: every type becomes chunks; the scan is listed as unreadable", async () => {
  const data = mkdtempSync(join(tmpdir(), "all-"));
  for (const d of ["heritage", "food", "handicraft", "business"]) mkdirSync(join(data, d));
  copyFileSync(join(FIX, "heritage.pdf"), join(data, "heritage", "heritage.pdf"));
  copyFileSync(join(FIX, "scanned.pdf"), join(data, "heritage", "scanned.pdf"));
  copyFileSync(join(FIX, "food.docx"), join(data, "food", "food.docx"));
  copyFileSync(join(FIX, "crafts.csv"), join(data, "handicraft", "crafts.csv"));
  await makeXlsx(join(data, "business", "shops.xlsx"));
  writeFileSync(join(data, "food", "notes.txt"), "Dates and Arabic coffee.");
  const r = await chunkAllDetailed(data);
  const byFile = (f: string) => r.chunks.filter((c) => c.file === f);
  for (const f of ["heritage.pdf", "food.docx", "crafts.csv", "shops.xlsx", "notes.txt"]) assert.ok(byFile(f).length > 0, f);
  assert.deepEqual(r.unreadableFiles, ["heritage/scanned.pdf"]);
  const perfume = byFile("shops.xlsx")[0];
  assert.equal(perfume.category, "business");
  assert.equal(perfume.title, "Al Fahidi Perfumes");
  assert.deepEqual(perfume.meta, { city: "Dubai", country: "UAE" });
  assert.equal(perfume.source, "shops.xlsx › Al Fahidi Perfumes — to verify");
});

test("PDF lines: an empty end-of-line piece does not lend its font size to the line", async () => {
  const { itemsToLines } = await import("./parsers/pdf");
  const lines = itemsToLines([
    { str: "5. Knafeh — molten cheese", fontSize: 10.5, y: 589, hasEOL: false },
    { str: "", fontSize: 14.5, y: 557, hasEOL: true },
    { str: "Abu Dhabi, UAE", fontSize: 14.5, y: 557, hasEOL: true },
  ]);
  assert.deepEqual(lines, [
    { text: "5. Knafeh — molten cheese", size: 10.5 },
    { text: "Abu Dhabi, UAE", size: 14.5 },
  ]);
});

test("PDF noise: running headers, page numbers, dot leaders and rules are removed", async () => {
  const { dropNoise } = await import("./parsers/pdf");
  const L = (text: string) => ({ text, size: 10 });
  const page = (n: number, body: string) => [L("THE HALAL FOOD COMPANION"), L(`Page ${n}`), L("— — — — —"), L(body)];
  const out = dropNoise([page(1, ". . . . . . . 5 Dubai"), page(2, "Dubai text"), page(3, "Doha text")]);
  assert.deepEqual(out.map((p) => p.map((l) => l.text)), [[], ["Dubai text"], ["Doha text"]]);
});

test("place spellings are matched across files", async () => {
  const { canonicalizePlaces } = await import("./canon");
  const mk = (city: string, region: string) => ({ id: city + region, category: "x", file: "f", title: "", section: "", text: "", source: "", hash: "", meta: { city, region } });
  const cs = [mk("Cappadocia (Göreme)", "Türkiye"), mk("Cappadocia (Göreme)", "Türkiye"), mk("Cappadocia / Göreme", "TÜRKIYE")];
  canonicalizePlaces(cs);
  assert.ok(cs.every((c) => c.meta.city === "Cappadocia (Göreme)" && c.meta.region === "Türkiye"));
});

test("region is the heading just above 'City, Country', even under a cover title", async () => {
  const dir = mkdtempSync(join(tmpdir(), "r-"));
  mkdirSync(join(dir, "food"));
  writeFileSync(join(dir, "food", "f.md"), "# THE COMPANION\n## MIDDLE EAST AND GULF\n### Dubai, UAE\n1. Machboos.");
  const r = await chunkAllDetailed(dir);
  assert.deepEqual(r.chunks[0].meta, { region: "MIDDLE EAST AND GULF", city: "Dubai", country: "UAE" });
  assert.equal(r.chunks[0].title, "Dubai, UAE");
});
