// ── Korean web-font presets for card headings/body ──────────────────────────
// Every font loads from a public CDN so the same HTML renders identically in
// the preview iframe and the Playwright PNG export.

export interface FontDef {
  id: string;
  name: string;
  /** CSS font-family stack */
  family: string;
  /** stylesheet URL (deduped when heading/body share one) */
  link: string;
  /** heaviest weight the font ships — display fonts are 400-only */
  maxWeight: number;
  hint?: string;
}

export const FONTS: FontDef[] = [
  {
    id: "pretendard",
    name: "프리텐다드",
    family: `'Pretendard', system-ui, -apple-system, sans-serif`,
    link: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css",
    maxWeight: 900,
  },
  {
    id: "noto-sans",
    name: "노토 산스",
    family: `'Noto Sans KR', sans-serif`,
    link: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap",
    maxWeight: 900,
  },
  {
    id: "gothic-a1",
    name: "고딕 A1",
    family: `'Gothic A1', sans-serif`,
    link: "https://fonts.googleapis.com/css2?family=Gothic+A1:wght@300;400;500;700;900&display=swap",
    maxWeight: 900,
  },
  {
    id: "nanum-gothic",
    name: "나눔고딕",
    family: `'Nanum Gothic', sans-serif`,
    link: "https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap",
    maxWeight: 800,
  },
  {
    id: "noto-serif",
    name: "노토 세리프 (명조)",
    family: `'Noto Serif KR', serif`,
    link: "https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&display=swap",
    maxWeight: 900,
  },
  {
    id: "nanum-myeongjo",
    name: "나눔명조",
    family: `'Nanum Myeongjo', serif`,
    link: "https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap",
    maxWeight: 800,
  },
  {
    id: "black-han",
    name: "블랙한산스",
    family: `'Black Han Sans', sans-serif`,
    link: "https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap",
    maxWeight: 400,
    hint: "임팩트 제목용",
  },
  {
    id: "do-hyeon",
    name: "도현",
    family: `'Do Hyeon', sans-serif`,
    link: "https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap",
    maxWeight: 400,
    hint: "포스터 제목용",
  },
  {
    id: "gowun-dodum",
    name: "고운돋움",
    family: `'Gowun Dodum', sans-serif`,
    link: "https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap",
    maxWeight: 400,
    hint: "부드러운 느낌",
  },
];

/** id → FontDef, falling back to Pretendard (also covers old saved projects). */
export function getFont(id?: string): FontDef {
  return FONTS.find((f) => f.id === id) || FONTS[0];
}

/** <link> tags for the given fonts, deduplicated. */
export function fontLinkTags(fonts: FontDef[]): string {
  const seen = new Set<string>();
  return fonts
    .filter((f) => (seen.has(f.link) ? false : (seen.add(f.link), true)))
    .map((f) => `<link rel="stylesheet" href="${f.link}">`)
    .join("\n");
}
