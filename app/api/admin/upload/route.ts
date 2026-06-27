import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isAdmin } from "@/lib/admin-auth";

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
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "8MB 이하 이미지만 업로드할 수 있습니다." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${EXT[file.type]}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);

  return NextResponse.json({ url: `/uploads/${name}` });
}
