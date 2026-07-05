import path from "node:path";
import { promises as fs } from "node:fs";
import { getImage } from "@/lib/db-postgres";

export const dynamic = "force-dynamic";

/**
 * 업로드 이미지 서빙 (저장 모드와 무관하게 동일 URL 형태 사용)
 * - Postgres 모드: DB(images 테이블)에서 읽음
 * - JSON 모드:     public/uploads 파일에서 읽음
 *   (next start 프로덕션 서버는 빌드 이후 추가된 public 파일을 정적 서빙하지 않으므로 라우트로 제공)
 */

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function notFound() {
  return new Response("Not Found", { status: 404 });
}

function ok(body: Uint8Array, mime: string) {
  // Node 런타임은 Uint8Array 바디를 지원하지만 TS lib 타입(제네릭)과 어긋나 캐스팅
  return new Response(body as unknown as BodyInit, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Postgres 모드: DB에서 서빙
  if (process.env.DATABASE_URL) {
    if (!/^img-[a-z0-9-]{4,64}$/.test(id)) return notFound();
    const img = await getImage(id);
    if (!img) return notFound();
    return ok(new Uint8Array(img.data), img.mime);
  }

  // JSON 모드: public/uploads 파일에서 서빙 (정규식이 경로 문자를 차단)
  const m = id.match(/^([a-z0-9-]{4,64})\.(jpg|jpeg|png|webp|gif)$/);
  if (!m) return notFound();
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "uploads", id));
    return ok(new Uint8Array(buf), MIME[m[2]]);
  } catch {
    return notFound();
  }
}
