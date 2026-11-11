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
