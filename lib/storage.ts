/**
 * 이미지 저장 계층 (서버 전용).
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 설정됨 → Supabase Storage (배포/영구 저장)
 *   - 미설정 → 로컬 public/uploads (로컬 개발용)
 *
 * 버킷은 첫 업로드 시 자동 생성(public)됩니다.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "uploads";

export const IMAGE_STORAGE: "supabase" | "local" =
  SUPABASE_URL && SERVICE_KEY ? "supabase" : "local";

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
  const filename = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  if (IMAGE_STORAGE === "supabase") {
    const client = await getClient();
    await ensureBucket(client);
    const { error } = await client.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType, upsert: false });
    if (error) throw new Error(error.message);
    const { data } = client.storage.from(BUCKET).getPublicUrl(filename);
    return data.publicUrl as string;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/uploads/${filename}`;
}
