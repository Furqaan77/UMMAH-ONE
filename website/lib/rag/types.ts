// Shared shapes for the RAG pipeline (architecture AD-1, AD-2). Defined once, used everywhere.

/** What every parser returns: a heading path and the text under it. */
export type Section = { headingPath: string[]; text: string };

export type ChunkMeta = { region?: string; country?: string; city?: string };

/** One searchable passage. `vector` is filled by the embed step (Story 1.2). */
export type Chunk = {
  id: string; // category/file#slug(headingPath)[-n]
  category: string; // first folder under data/
  file: string; // file name, e.g. ALL-81-CITIES.md
  title: string; // the item, e.g. "Dubai, UAE"
  section: string; // the nearest heading, e.g. "20 Things to Do in Dubai"
  text: string;
  meta: ChunkMeta;
  source: string; // "<file> › <section> — to verify"
  hash: string; // sha256 of the content; changes when the content changes
  vector?: number[];
};

/** Optional <file>.meta.json next to a data file. */
export type FileMeta = ChunkMeta & {
  /** Read region/country/city from "# Region — …" and "## City, Country" headings. Default true. */
  placeHeadings?: boolean;
  /** Use the "#" heading as region. Default true; set false when "#" is just a file title. */
  regionFromHeading?: boolean;
};

export class Unreadable extends Error {
  constructor(public file: string, reason = "no readable text") {
    super(`${file}: ${reason}`);
    this.name = "Unreadable";
  }
}

export class BlockedPlaceError extends Error {
  constructor(public file: string, public place: string, public heading: string) {
    super(`${file}: blocked place "${place}" in heading "${heading}"`);
    this.name = "BlockedPlaceError";
  }
}
