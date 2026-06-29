import { NextResponse } from "next/server";
import { chat, resolveLLM, MissingKeyError } from "@/lib/llm";
import { summarizeSystem, summarizeUser } from "@/lib/prompts";
import type { NewsItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mockSummary(topic: string, items: NewsItem[]): string {
  const bullets = items
    .slice(0, 6)
    .map((it) => `- ${it.title} (${it.source})${it.snippet ? `\n  - ${it.snippet.slice(0, 120)}` : ""}`)
    .join("\n");
  return `**${topic} — 핵심 요약 (데모 데이터)**\n\n- 선택한 ${items.length}개 기사를 바탕으로 한 임시 요약입니다.\n${bullets}\n\n> ⚠️ 실제 AI 요약을 보려면 설정(⚙️)에서 API 키를 입력하세요.`;
}

export async function POST(req: Request) {
  try {
    const { topic, items, settings } = await req.json();
    const list: NewsItem[] = Array.isArray(items) ? items : [];
    if (list.length === 0) {
      return NextResponse.json({ error: "요약할 기사를 1개 이상 선택하세요." }, { status: 400 });
    }
    const llm = resolveLLM(settings);
    try {
      const summary = await chat(llm, {
        system: summarizeSystem(),
        user: summarizeUser(topic || "", list),
        maxTokens: 1500,
        temperature: 0.4,
      });
      return NextResponse.json({ summary });
    } catch (err) {
      if (err instanceof MissingKeyError) {
        return NextResponse.json({ summary: mockSummary(topic || "", list), mock: true });
      }
      throw err;
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
