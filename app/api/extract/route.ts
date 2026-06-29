import { NextResponse } from "next/server";
import { extractArticle } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
    }
    const { text, finalUrl } = await extractArticle(url);
    return NextResponse.json({ text, finalUrl });
  } catch (err) {
    // extraction is best-effort — never hard-fail the pipeline
    return NextResponse.json({ text: "", error: (err as Error).message });
  }
}
