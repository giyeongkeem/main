import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { topic, feeds } = await req.json();
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "주제(topic)를 입력하세요." }, { status: 400 });
    }
    const items = await fetchNews({ topic, feeds: Array.isArray(feeds) ? feeds : [] });
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
