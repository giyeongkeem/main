import type { Card, Design, ImageMode, Meta } from "./types";
import { fontLinkTags, getFont } from "./fonts";

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

/** safe to drop inside url("…") in CSS */
function cssUrl(u = ""): string {
  return u.replace(/"/g, "%22").replace(/\n/g, "");
}

export interface RenderArgs {
  card: Card;
  design: Design;
  meta: Meta;
  index: number;
  total: number;
  /**
   * Preview-only editing mode: text becomes contenteditable, empty fields show
   * placeholders, and edits/clicks are reported to the parent window as
   * {type:"cardnews-edit"|"cardnews-focus", field, value} messages.
   * NEVER set for export — placeholders/outlines would end up in the PNG.
   */
  interactive?: boolean;
}

// Runs inside the preview iframe. Static string — no interpolation needed.
const EDIT_SCRIPT = `
<script>
(function () {
  document.querySelectorAll('[data-field]').forEach(function (el) {
    var field = el.getAttribute('data-field');
    var editable = el.getAttribute('data-editable') === 'true';
    if (!editable) {
      el.addEventListener('click', function () {
        parent.postMessage({ type: 'cardnews-focus', field: field }, '*');
      });
      return;
    }
    try { el.contentEditable = 'plaintext-only'; } catch (e) { el.contentEditable = 'true'; }
    el.addEventListener('focus', function () {
      parent.postMessage({ type: 'cardnews-focus', field: field }, '*');
      if (el.getAttribute('data-empty') === '1') {
        try { document.execCommand('selectAll', false, undefined); } catch (e) {}
      }
    });
    el.addEventListener('input', function () { el.setAttribute('data-empty', '0'); });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && (field === 'title' || field === 'eyebrow')) {
        ev.preventDefault();
        el.blur();
      }
    });
    el.addEventListener('blur', function () {
      var value = el.getAttribute('data-empty') === '1' ? '' : el.innerText.replace(/\\n+$/, '');
      parent.postMessage({ type: 'cardnews-edit', field: field, value: value }, '*');
    });
  });
})();
</script>`;

/** Returns a complete, standalone HTML document for ONE card at exact size. */
export function renderCardHTML({ card, design, meta, index, total, interactive }: RenderArgs): string {
  const { palette: p, template, headingScale: hs, size } = design;
  const isCover = card.kind === "cover";
  const isClosing = card.kind === "closing";

  // ── fonts ──
  const headingFont = getFont(design.headingFont);
  const bodyFont = getFont(design.bodyFont);
  const fontLinks = fontLinkTags([headingFont, bodyFont]);
  const templateHeadingWeight = template === "editorial" ? 700 : 800;
  const headingWeight = Math.min(templateHeadingWeight, headingFont.maxWeight);
  const headingLh = template === "editorial" ? 1.28 : 1.14;
  const headingTracking = template === "editorial" ? "0em" : "-0.01em";

  // ── image ──
  const hasImg = !!card.image;
  const mode: ImageMode = card.imageMode || (isCover ? "background" : "top");
  const overlay = typeof card.imageOverlay === "number" ? card.imageOverlay : 0.5;
  const bgPhoto = hasImg && mode === "background";
  const topPhoto = hasImg && mode === "top";
  const imgUrl = hasImg ? cssUrl(card.image) : "";
  const topH = Math.round(size.h * (isCover ? 0.3 : 0.36));

  // background
  let bg = p.bg;
  if (template === "gradient") {
    bg = `linear-gradient(155deg, ${p.bg} 0%, ${hexToRgba(p.accent, 0.28)} 70%, ${p.bg} 130%)`;
  }

  const coverSize = Math.round((template === "bold" ? 108 : 92) * hs);
  const titleSize = Math.round((template === "bold" ? 78 : 64) * hs);
  const bodySize = Math.round(40 * Math.min(hs, 1.15));

  // over a photo background, use full-strength text for legibility
  const bodyColor = bgPhoto ? p.fg : isCover ? p.fg : p.muted;
  const subColor = bgPhoto ? p.fg : p.muted;

  const textAlign = card.align || (isCover ? "center" : "left");
  const alignItems = textAlign === "center" ? "center" : "flex-start";
  const justify = isCover ? "flex-end" : isClosing ? "center" : "center";
  const padBottom = isCover ? 176 : 110;

  // ── text blocks (with click-to-edit placeholders in interactive mode) ──
  const field = (name: string, empty: boolean) =>
    interactive ? ` data-field="${name}" data-editable="true" data-empty="${empty ? 1 : 0}"` : "";

  const eyebrowText = card.eyebrow || (interactive ? "라벨" : "");
  const eyebrowHtml = eyebrowText
    ? template === "bold" || template === "gradient"
      ? `<span class="eyebrow chip"${field("eyebrow", !card.eyebrow)}>${esc(eyebrowText)}</span>`
      : `<span class="eyebrow rule"${field("eyebrow", !card.eyebrow)}>${esc(eyebrowText)}</span>`
    : "";

  const titleText = card.title || (interactive ? "제목을 입력하세요" : "");
  const titleHtml = titleText ? `<h1 class="title"${field("title", !card.title)}>${esc(titleText)}</h1>` : "";

  const bodyText = card.body || (interactive ? "본문을 입력하세요" : "");
  const bodyBlock = isCover
    ? bodyText
      ? `<p class="cover-sub"${field("body", !card.body)}>${esc(bodyText)}</p>`
      : ""
    : bodyText
      ? `<div class="body"${field("body", !card.body)}>${paras(bodyText)}</div>`
      : "";

  const footerBits: string[] = [];
  if (design.showHandle && meta.handle) footerBits.push(`<span class="handle">${esc(meta.handle)}</span>`);
  if (design.showPageNumbers && total > 1)
    footerBits.push(`<span class="page">${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>`);
  const footer = footerBits.length ? `<footer class="foot">${footerBits.join("")}</footer>` : "";

  const swipe = isCover && total > 1 ? `<div class="swipe">밀어서 보기 →</div>` : "";
  const imgField = interactive ? ` data-field="image" data-editable="false"` : "";

  const interactiveCss = interactive
    ? `
  [data-editable="true"] { cursor: text; border-radius: 8px; }
  [data-editable="true"]:hover { outline: 3px dashed ${hexToRgba(p.accent, 0.6)}; outline-offset: 8px; }
  [data-editable="true"]:focus { outline: 3px solid ${p.accent}; outline-offset: 8px; }
  [data-editable="true"][data-empty="1"] { opacity: 0.45; }
  [data-field="image"] { cursor: pointer; }
  [data-field="image"]:hover { outline: 4px dashed ${hexToRgba(p.accent, 0.7)}; outline-offset: -4px; }
  [contenteditable] { caret-color: ${p.accent}; }
  `
    : "";

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${size.w}">
${fontLinks}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #000; }
  .canvas {
    width: ${size.w}px;
    height: ${size.h}px;
    background: ${bg};
    color: ${p.fg};
    font-family: ${bodyFont.family};
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: ${justify};
    align-items: ${alignItems};
    text-align: ${textAlign};
    padding: 110px 96px ${padBottom}px;
    word-break: keep-all;
    overflow-wrap: anywhere;
    -webkit-font-smoothing: antialiased;
  }
  .bg-photo {
    position: absolute; inset: 0; z-index: 0;
    background: url("${imgUrl}") center / cover no-repeat;
  }
  .bg-scrim {
    position: absolute; inset: 0; z-index: 0;
    background: linear-gradient(180deg,
      ${hexToRgba(p.bg, overlay * 0.55)} 0%,
      ${hexToRgba(p.bg, overlay * 0.82)} 45%,
      ${hexToRgba(p.bg, Math.min(overlay + 0.22, 0.94))} 100%);
  }
  .stack {
    position: relative; z-index: 2;
    display: flex; flex-direction: column; align-items: ${alignItems};
    gap: 40px; max-width: 100%; width: 100%;
    ${isCover ? "" : "flex: 1; justify-content: center;"}
  }
  .top-photo {
    width: 100%; height: ${topH}px; border-radius: 28px;
    background: url("${imgUrl}") center / cover no-repeat;
    box-shadow: 0 20px 60px ${hexToRgba("#000000", 0.35)};
  }
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
    font-family: ${headingFont.family};
    font-size: ${isCover ? coverSize : titleSize}px;
    font-weight: ${headingWeight};
    line-height: ${headingLh};
    letter-spacing: ${headingTracking};
    ${isCover ? "max-width: 16ch;" : ""}
  }
  .body { display: flex; flex-direction: column; gap: 22px; }
  .body p { font-size: ${bodySize}px; line-height: 1.6; color: ${bodyColor}; }
  .cover-sub { font-size: ${Math.round(44 * hs)}px; color: ${subColor}; line-height: 1.5; max-width: 22ch; }
  .foot {
    position: absolute; z-index: 2;
    left: 96px; right: 96px; bottom: 70px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 28px; color: ${bgPhoto ? p.fg : p.muted}; font-weight: 600;
  }
  .handle { color: ${bgPhoto ? p.fg : p.accent}; }
  .page { font-variant-numeric: tabular-nums; letter-spacing: 0.08em; }
  .swipe {
    margin-top: 16px;
    font-size: 28px; color: ${subColor}; font-weight: 600; letter-spacing: 0.05em;
  }
  .accent-bar { width: 88px; height: 10px; border-radius: 999px; background: ${p.accent}; }
${interactiveCss}
</style>
</head>
<body>
  <div class="canvas" data-card>
    ${bgPhoto ? `<div class="bg-photo"></div><div class="bg-scrim"${imgField}></div>` : ""}
    <div class="stack">
      ${topPhoto ? `<div class="top-photo"${imgField}></div>` : ""}
      ${eyebrowHtml}
      ${!isCover && template !== "bold" && !topPhoto ? `<div class="accent-bar"></div>` : ""}
      ${titleHtml}
      ${bodyBlock}
      ${swipe}
    </div>
    ${footer}
  </div>
${interactive ? EDIT_SCRIPT : ""}
</body>
</html>`;
}
