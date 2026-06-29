import { NextResponse } from "next/server";
import { chat, resolveLLM, parseJSON, MissingKeyError } from "@/lib/llm";
import { articleSystem, articleUser } from "@/lib/prompts";
import type { Article, Card, CardKind, Meta } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let counter = 0;
const cid = () => `c${Date.now().toString(36)}${(counter++).toString(36)}`;

interface RawCard { kind?: string; eyebrow?: string; title?: string; body?: string }

function normalize(raw: { headline?: string; subtitle?: string; caption?: string; cards?: RawCard[] }): Article {
  const cards: Card[] = (raw.cards || []).map((c, i): Card => {
    let kind: CardKind = "content";
    if (c.kind === "cover" || (i === 0 && !c.kind)) kind = "cover";
    else if (c.kind === "closing") kind = "closing";
    return { id: cid(), kind, eyebrow: c.eyebrow, title: c.title, body: c.body };
  });
  if (cards.length && cards[0].kind !== "cover") cards[0].kind = "cover";
  if (cards.length > 1 && !cards.some((c) => c.kind === "closing")) cards[cards.length - 1].kind = "closing";
  return {
    headline: raw.headline || cards[0]?.title || "제목",
    subtitle: raw.subtitle,
    caption: raw.caption,
    cards,
  };
}

function mockArticle(meta: Meta, summary: string): Article {
  const lines = summary
    .split("\n")
    .map((l) => l.replace(/^[-*#>\s]+/, "").trim())
    .filter((l) => l.length > 8)
    .slice(0, 4);
  const cards: Card[] = [
    { id: cid(), kind: "cover", eyebrow: meta.topic || "카드뉴스", title: meta.topic || "오늘의 이슈", body: "밀어서 핵심만 빠르게" },
    ...lines.map((l, i): Card => ({ id: cid(), kind: "content", eyebrow: String(i + 1).padStart(2, "0"), title: l.slice(0, 24), body: l })),
    { id: cid(), kind: "closing", eyebrow: "정리", title: "핵심 한 줄", body: "저장해두고 다시 보세요. (데모 데이터 — 설정에서 API 키를 입력하면 실제 생성됩니다)" },
  ];
  return { headline: meta.topic || "오늘의 이슈", subtitle: "데모 데이터", caption: `#${(meta.topic || "카드뉴스").replace(/\s/g, "")} #카드뉴스`, cards };
}

export async function POST(req: Request) {
  try {
    const { meta, summary, cardCount, settings } = await req.json();
    if (!summary || typeof summary !== "string") {
      return NextResponse.json({ error: "요약(summary)이 필요합니다." }, { status: 400 });
    }
    const m: Meta = meta;
    const llm = resolveLLM(settings);
    try {
      const raw = await chat(llm, {
        system: articleSystem(),
        user: articleUser(m, summary, Math.min(Math.max(Number(cardCount) || 7, 4), 10)),
        maxTokens: 2500,
        temperature: 0.7,
      });
      const article = normalize(parseJSON(raw));
      if (!article.cards.length) throw new Error("카드를 생성하지 못했습니다.");
      return NextResponse.json({ article });
    } catch (err) {
      if (err instanceof MissingKeyError) {
        return NextResponse.json({ article: mockArticle(m, summary), mock: true });
      }
      throw err;
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
