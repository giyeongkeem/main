import { getImage } from "@/lib/db-postgres";

export const dynamic = "force-dynamic";

/**
 * PostgreSQL(images 테이블)에 저장된 업로드 이미지 서빙.
 * (Supabase Storage 사용 시엔 공개 URL이 직접 쓰이고, 로컬 파일은 /api/uploads 가 담당)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!process.env.DATABASE_URL || !/^img-[a-z0-9-]{4,64}$/.test(id)) {
    return new Response("Not Found", { status: 404 });
  }
  const img = await getImage(id);
  if (!img) return new Response("Not Found", { status: 404 });
  // Node 런타임은 Uint8Array 바디를 지원하지만 TS lib 타입(제네릭)과 어긋나 캐스팅
  return new Response(new Uint8Array(img.data) as unknown as BodyInit, {
    headers: {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
