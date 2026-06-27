/**
 * 로컬 파일(JSON) 저장 백엔드 — 기본값(설정 불필요).
 * DATABASE_URL 이 없을 때 사용됩니다.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Listing } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "listings.json");

export async function getAll(seed: Listing[]): Promise<Listing[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as Listing[];
  } catch {
    await saveAll(seed);
    return seed;
  }
}

export async function saveAll(items: Listing[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}
