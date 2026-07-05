import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { saveImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
  } catch {
    return NextResponse.json({ error: "잘못된 업로드 요청입니다." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "이미지 파일(jpg, png, webp, gif)만 업로드할 수 있습니다." },
      { status: 400 }
    );
  }
  // Vercel 등 서버리스의 요청 본문 제한(4.5MB)을 고려한 상한
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "4MB 이하 이미지만 업로드할 수 있습니다." }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await saveImage(buf, EXT[file.type], file.type);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}
