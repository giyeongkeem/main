/**
 * 이미지 저장 계층 (서버 전용) — 설정에 따라 자동 선택됩니다.
 *   1) SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → Supabase Storage(공개 버킷, CDN) — 운영 권장
 *   2) DATABASE_URL만 있음                     → PostgreSQL(images 테이블, bytea)
 *      (서버리스에서 Storage 설정 없이도 업로드가 동작하는 폴백)
 *   3) 둘 다 없음                               → 로컬 data/uploads (/api/uploads 로 서빙, 로컬 개발용)
 *
 * Supabase 버킷은 첫 업로드 시 자동 생성(public)됩니다.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveImage as savePgImage } from "./db-postgres";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "uploads";

export const IMAGE_STORAGE: "supabase" | "postgres" | "local" =
  SUPABASE_URL && SERVICE_KEY
    ? "supabase"
    : process.env.DATABASE_URL
      ? "postgres"
      : "local";

let bucketReady: Promise<void> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getClient(): Promise<any> {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureBucket(client: any): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data } = await client.storage.getBucket(BUCKET);
      if (!data) {
        await client.storage.createBucket(BUCKET, { public: true });
      }
    })().catch((e) => {
      bucketReady = null;
      throw e;
    });
  }
  return bucketReady;
}

export async function saveImage(
  buffer: Buffer,
  ext: string,
  contentType: string
): Promise<string> {
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (IMAGE_STORAGE === "supabase") {
    const filename = `${key}.${ext}`;
    const client = await getClient();
    await ensureBucket(client);
    const { error } = await client.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    const { data } = client.storage.from(BUCKET).getPublicUrl(filename);
    return data.publicUrl as string;
  }

  if (IMAGE_STORAGE === "postgres") {
    const id = `img-${key}`;
    await savePgImage(id, contentType, buffer);
    return `/api/images/${id}`;
  }

  const filename = `${key}.${ext}`;
  const dir = path.join(process.cwd(), "data", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  // /api/uploads 로 서빙 — next dev/start 모두 동작
  return `/api/uploads/${filename}`;
}
