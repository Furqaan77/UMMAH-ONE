import { readFileSync } from "node:fs";
import { basename } from "node:path";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { Unreadable, type ChunkMeta, type Section } from "../types";

/**
 * Tables (Excel, CSV): the first row is the header; every other row becomes one section.
 * The row's title is the first non-empty cell; the text keeps column names ("City: Dubai").
 * Columns named City, Country or Region set the place directly.
 */
export function rowsToSections(name: string, sheet: string | null, rows: string[][]): Section[] {
  const [header, ...body] = rows.map((r) => r.map((c) => (c ?? "").toString().trim()));
  if (!header || !body.length) return [];
  const col = (n: string) => header.findIndex((h) => h.toLowerCase() === n);
  const [ci, ki, ri] = [col("city"), col("country"), col("region")];
  const out: Section[] = [];
  body.forEach((row, i) => {
    const cells = header.map((h, j) => [h || `Column ${j + 1}`, row[j] ?? ""] as const).filter(([, v]) => v);
    if (!cells.length) return;
    const meta: ChunkMeta = {};
    if (ci >= 0 && row[ci]) meta.city = row[ci];
    if (ki >= 0 && row[ki]) meta.country = row[ki];
    if (ri >= 0 && row[ri]) meta.region = row[ri];
    const title = cells[0][1] || `Row ${i + 2}`;
    out.push({
      headingPath: [sheet ? `${name} › ${sheet}` : name, title],
      text: cells.map(([h, v]) => `${h}: ${v}`).join("\n"),
      ...(Object.keys(meta).length ? { meta } : {}),
    });
  });
  return out;
}

export async function parseXlsx(path: string): Promise<Section[]> {
  const name = basename(path);
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(path);
  } catch (e) {
    throw new Unreadable(name, `cannot open Excel file (${e instanceof Error ? e.message : e})`);
  }
  const sheets: { name: string; rows: string[][] }[] = [];
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) vals.push(cellText(row.getCell(c).value));
      rows.push(vals);
    });
    if (rows.length > 1) sheets.push({ name: ws.name, rows });
  });
  // Name the sheet in titles only when more than one sheet has data.
  const out = sheets.flatMap((sh) => rowsToSections(name, sheets.length > 1 ? sh.name : null, sh.rows));
  if (!out.length) throw new Unreadable(name, "no rows below the header");
  return out;
}

export function parseCsv(path: string): Section[] {
  const name = basename(path);
  const res = Papa.parse<string[]>(readFileSync(path, "utf8").replace(/^﻿/, ""), { skipEmptyLines: true });
  const out = rowsToSections(name, null, res.data);
  if (!out.length) throw new Unreadable(name, "no rows below the header");
  return out;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return v.result == null ? "" : String(v.result);
    if ("error" in v) return "";
  }
  return String(v);
}
