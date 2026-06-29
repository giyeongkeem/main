import type { Card, Design, Meta } from "./types";

const FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap">
`;

function esc(s = ""): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** body text → paragraphs, preserving intentional line breaks */
function paras(s = ""): string {
  return s
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function hexToRgba(hex: string, a: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const SANS = `'Pretendard', system-ui, -apple-system, sans-serif`;
const SERIF = `'Nanum Myeongjo', 'Pretendard', serif`;

export interface RenderArgs {
  card: Card;
  design: Design;
  meta: Meta;
  index: number;
  total: number;
}

/** Returns a complete, standalone HTML document for ONE card at exact size. */
export function renderCardHTML({ card, design, meta, index, total }: RenderArgs): string {
  const { palette: p, template, headingScale: hs, size } = design;
  const isCover = card.kind === "cover";
  const isClosing = card.kind === "closing";
  const headingFont = template === "editorial" ? SERIF : SANS;

  // background
  let bg = p.bg;
  if (template === "gradient") {
    bg = `linear-gradient(155deg, ${p.bg} 0%, ${hexToRgba(p.accent, 0.28)} 70%, ${p.bg} 130%)`;
  }

  const coverSize = Math.round((template === "bold" ? 108 : 92) * hs);
  const titleSize = Math.round((template === "bold" ? 78 : 64) * hs);
  const bodySize = Math.round(40 * Math.min(hs, 1.15));

  // eyebrow rendering differs: bold uses an accent chip; others use a small label
  const eyebrowHtml = card.eyebrow
    ? template === "bold" || template === "gradient"
      ? `<span class="eyebrow chip">${esc(card.eyebrow)}</span>`
      : `<span class="eyebrow rule">${esc(card.eyebrow)}</span>`
    : "";

  const titleHtml = card.title ? `<h1 class="title">${esc(card.title)}</h1>` : "";
  const bodyHtml = card.body ? `<div class="body">${paras(card.body)}</div>` : "";

  const footerBits: string[] = [];
  if (design.showHandle && meta.handle) footerBits.push(`<span class="handle">${esc(meta.handle)}</span>`);
  if (design.showPageNumbers && total > 1)
    footerBits.push(`<span class="page">${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>`);
  const footer = footerBits.length ? `<footer class="foot">${footerBits.join("")}</footer>` : "";

  const swipe = isCover && total > 1 ? `<div class="swipe">밀어서 보기 →</div>` : "";

  // cover content is bottom-aligned — reserve clearance so it never collides
  // with the footer (handle / page number) sitting at the very bottom.
  const padBottom = isCover ? 176 : 110;
  const align = isCover ? "center" : "flex-start";
  const justify = isCover ? "flex-end" : isClosing ? "center" : "center";

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${size.w}">
${FONT_LINKS}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #000; }
  .canvas {
    width: ${size.w}px;
    height: ${size.h}px;
    background: ${bg};
    color: ${p.fg};
    font-family: ${SANS};
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: ${justify};
    align-items: ${align};
    text-align: ${isCover ? "center" : "left"};
    padding: 110px 96px ${padBottom}px;
    word-break: keep-all;
    overflow-wrap: anywhere;
    -webkit-font-smoothing: antialiased;
  }
  .stack { display: flex; flex-direction: column; align-items: ${align}; gap: 40px; max-width: 100%; ${isCover ? "" : "flex: 1; justify-content: center;"} }
  .eyebrow { font-size: 30px; font-weight: 700; letter-spacing: 0.04em; }
  .chip {
    display: inline-block;
    background: ${p.accent};
    color: ${p.accentText || p.bg};
    padding: 12px 26px;
    border-radius: 999px;
  }
  .rule {
    color: ${p.accent};
    border-bottom: 4px solid ${p.accent};
    padding-bottom: 12px;
    display: inline-block;
  }
  .title {
    font-family: ${headingFont};
    font-size: ${isCover ? coverSize : titleSize}px;
    font-weight: 800;
    line-height: ${template === "editorial" ? 1.22 : 1.14};
    letter-spacing: -0.01em;
  }
  ${isCover ? `.title { max-width: 14ch; }` : ""}
  .body { display: flex; flex-direction: column; gap: 22px; }
  .body p { font-size: ${bodySize}px; line-height: 1.6; color: ${isCover ? p.fg : p.muted}; }
  .cover-sub { font-size: ${Math.round(44 * hs)}px; color: ${p.muted}; line-height: 1.5; max-width: 20ch; }
  .foot {
    position: absolute;
    left: 96px; right: 96px; bottom: 70px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 28px; color: ${p.muted}; font-weight: 600;
  }
  .handle { color: ${p.accent}; }
  .page { font-variant-numeric: tabular-nums; letter-spacing: 0.08em; }
  .swipe {
    margin-top: 16px;
    font-size: 28px; color: ${p.muted}; font-weight: 600; letter-spacing: 0.05em;
  }
  .accent-bar { width: 88px; height: 10px; border-radius: 999px; background: ${p.accent}; }
</style>
</head>
<body>
  <div class="canvas" data-card>
    <div class="stack">
      ${eyebrowHtml}
      ${!isCover && template !== "bold" ? `<div class="accent-bar"></div>` : ""}
      ${titleHtml}
      ${isCover && card.body ? `<p class="cover-sub">${esc(card.body)}</p>` : isCover ? "" : bodyHtml}
      ${swipe}
    </div>
    ${footer}
  </div>
</body>
</html>`;
}
