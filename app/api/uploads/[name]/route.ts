import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// 로컬(data/uploads)에 저장된 업로드 이미지를 서빙합니다. (Supabase 사용 시엔 미사용)
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|jpeg|png|webp|gif)$/i.test(name)) {
    return new NextResponse("not found", { status: 404 });
  }
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "data", "uploads", name));
    const ext = name.split(".").pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
