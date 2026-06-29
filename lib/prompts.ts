import type { Meta, NewsItem } from "./types";

// ── Step 2: summarize selected articles into key points ─────────────────────

export function summarizeSystem(): string {
  return [
    "당신은 한국어 뉴스 큐레이터입니다.",
    "여러 기사에서 핵심 사실만 골라 카드뉴스 제작에 쓸 요약 노트를 만듭니다.",
    "추측·과장 없이 기사에 있는 사실만 사용하고, 출처별로 엇갈리는 내용은 표시합니다.",
    "결과는 마크다운 불릿으로, 간결한 문장으로 작성합니다.",
  ].join(" ");
}

export function summarizeUser(topic: string, items: NewsItem[]): string {
  const blocks = items
    .map((it, i) => {
      const body = it.content && it.content.length > 80 ? it.content : it.snippet || "(본문 없음)";
      return `[${i + 1}] ${it.title} — ${it.source}${it.published ? ` (${it.published})` : ""}\n${body}`;
    })
    .join("\n\n---\n\n");
  return [
    `주제: ${topic || "(미지정)"}`,
    "",
    "아래 기사들을 바탕으로 카드뉴스용 요약 노트를 작성하세요.",
    "포함: ① 한 줄 핵심 ② 주요 사실 5~8개(숫자·날짜·인용 포함) ③ 맥락/배경 ④ 독자가 알아야 할 시사점.",
    "",
    blocks,
  ].join("\n");
}

// ── Step 3: turn the summary into a structured card-news article ────────────

export function articleSystem(): string {
  return [
    "당신은 인스타그램 카드뉴스 전문 에디터입니다.",
    "요약 노트를 바탕으로 스와이프형 카드뉴스 한 세트를 설계합니다.",
    "각 카드는 한눈에 읽히도록 짧고 강하게. 한 카드의 본문은 2~4문장 이내.",
    "표지 카드는 스크롤을 멈추게 하는 후킹 제목, 마지막 카드는 요약+행동유도(CTA).",
    "반드시 사실에 근거하고, 모르는 내용은 지어내지 않습니다.",
    "출력은 지정한 JSON 스키마만, 그 외 텍스트 없이 반환합니다.",
  ].join(" ");
}

export function articleUser(meta: Meta, summary: string, cardCount = 7): string {
  return [
    `주제: ${meta.topic || "(미지정)"}`,
    meta.angle ? `관점/앵글: ${meta.angle}` : "",
    `톤앤매너: ${meta.tone}`,
    "",
    "아래 요약 노트로 카드뉴스를 만드세요.",
    "",
    summary,
    "",
    `표지 1장 + 본문 ${cardCount - 2}장 + 마무리 1장, 총 ${cardCount}장 내외로 구성하세요.`,
    "다음 JSON 스키마로만 응답하세요:",
    `{
  "headline": "표지 대제목 (12~22자, 강한 후킹)",
  "subtitle": "표지 한 줄 부제 (선택)",
  "caption": "인스타 캡션 + 해시태그 5~8개",
  "cards": [
    { "kind": "cover", "eyebrow": "카테고리/날짜", "title": "표지 제목", "body": "부제 또는 한 줄 요약" },
    { "kind": "content", "eyebrow": "01", "title": "소제목", "body": "본문 2~4문장" },
    { "kind": "closing", "eyebrow": "정리", "title": "핵심 요약", "body": "마무리 + CTA" }
  ]
}`,
  ]
    .filter(Boolean)
    .join("\n");
}
