import type { Palette, CanvasSize, Design, Meta, TemplateId } from "./types";

// ── Instagram canvas sizes ──────────────────────────────────────────────────
export const SIZES: CanvasSize[] = [
  { id: "portrait", label: "세로 4:5 (1080×1350)", w: 1080, h: 1350 },
  { id: "square", label: "정사각 1:1 (1080×1080)", w: 1080, h: 1080 },
  { id: "story", label: "스토리 9:16 (1080×1920)", w: 1080, h: 1920 },
];

// ── Color palettes ──────────────────────────────────────────────────────────
export const PALETTES: Palette[] = [
  { id: "ink", name: "잉크", bg: "#11131a", fg: "#f4f5f7", accent: "#5b8cff", muted: "#9aa3b2", accentText: "#0a0d14" },
  { id: "cream", name: "크림", bg: "#f5f1e8", fg: "#1c1a17", accent: "#e2562a", muted: "#7a7367", accentText: "#fff7f0" },
  { id: "forest", name: "포레스트", bg: "#0f1f17", fg: "#eef6f0", accent: "#5fd39a", muted: "#8aa697", accentText: "#08130d" },
  { id: "grape", name: "그레이프", bg: "#1a1330", fg: "#f3eeff", accent: "#b78cff", muted: "#9c91b8", accentText: "#120a24" },
  { id: "mono", name: "모노", bg: "#ffffff", fg: "#111111", accent: "#111111", muted: "#888888", accentText: "#ffffff" },
  { id: "sunrise", name: "선라이즈", bg: "#fff7ed", fg: "#2b1a0e", accent: "#f59e0b", muted: "#9a7b53", accentText: "#2b1a0e" },
];

export const TEMPLATES: { id: TemplateId; name: string; hint: string }[] = [
  { id: "editorial", name: "에디토리얼", hint: "가는 헤드라인 · 넓은 행간 · 차분하고 신뢰감" },
  { id: "bold", name: "볼드", hint: "큰 고딕 · 강한 대비 · 임팩트" },
  { id: "minimal", name: "미니멀", hint: "여백 중심 · 깔끔" },
  { id: "gradient", name: "그라디언트", hint: "부드러운 배경 그라데이션" },
];

export const DEFAULT_DESIGN: Design = {
  template: "bold",
  palette: PALETTES[0],
  size: SIZES[0],
  headingScale: 1,
  showPageNumbers: true,
  showHandle: true,
};

export const DEFAULT_META: Meta = {
  topic: "",
  angle: "",
  tone: "정보 전달 · 신뢰감 있는",
  handle: "@my.cardnews",
};

// ── Default RSS feeds (편집 가능) ────────────────────────────────────────────
// Google News RSS 검색은 키워드 기반으로 주제와 관련된 최신 기사를 가져옵니다.
// 아래 고정 피드는 키워드로 한 번 더 필터링됩니다.
export interface FeedSource {
  name: string;
  url: string;
  enabled: boolean;
}

export const DEFAULT_FEEDS: FeedSource[] = [
  { name: "연합뉴스", url: "https://www.yna.co.kr/rss/news.xml", enabled: true },
  { name: "한겨레", url: "https://www.hani.co.kr/rss/", enabled: true },
  { name: "경향신문", url: "https://www.khan.co.kr/rss/rssdata/total_news.xml", enabled: true },
  { name: "ZDNet Korea", url: "https://feeds.feedburner.com/zdkorea", enabled: false },
];
