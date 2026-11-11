// Where the index lives (AD-4, AD-6). Local JSON now; a Supabase pgvector store can implement the same interface later.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Chunk } from "./types";

export type Index = { model: string; dims: number; builtAt: string; chunks: Chunk[] };

export interface ChunkStore {
  load(): Index | null;
  write(index: Index): void;
}

export const DEFAULT_INDEX_PATH = join(process.cwd(), ".data", "index.json");

export class JsonStore implements ChunkStore {
  constructor(public path: string = DEFAULT_INDEX_PATH) {}

  load(): Index | null {
    if (!existsSync(this.path)) return null;
    try {
      return JSON.parse(readFileSync(this.path, "utf8")) as Index;
    } catch {
      console.warn(`${this.path} is damaged; it will be rebuilt.`);
      return null;
    }
  }

  /** Atomic: write a temp file, then rename over the old index. */
  write(index: Index): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(index));
    renameSync(tmp, this.path);
  }
}
