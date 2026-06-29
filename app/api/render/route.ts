import { NextResponse } from "next/server";
import { renderCardsToPng, zipPngs } from "@/lib/render";
import type { RenderRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Build an HTTP-header-safe Content-Disposition (ASCII fallback + UTF-8 filename*). */
function disposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_") || "download";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RenderRequest & { single?: number };
    const { cards, design, meta } = body;
    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: "내보낼 카드가 없습니다." }, { status: 400 });
    }

    // single card → return one PNG (used by per-card download)
    if (typeof body.single === "number") {
      const card = cards[body.single];
      if (!card) return NextResponse.json({ error: "카드를 찾을 수 없습니다." }, { status: 400 });
      const [file] = await renderCardsToPng([card], design, meta);
      return new NextResponse(new Uint8Array(file.buffer), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": disposition(file.name),
        },
      });
    }

    const files = await renderCardsToPng(cards, design, meta);
    const zip = await zipPngs(files, meta);
    const base = (meta.topic || "cardnews").trim().replace(/\s+/g, "-").slice(0, 40) || "cardnews";
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": disposition(`${base}.zip`),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
