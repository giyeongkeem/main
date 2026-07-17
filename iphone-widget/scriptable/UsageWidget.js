// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: chart-bar;
//
// ─────────────────────────────────────────────────────────────
// Claude Code + Codex 사용량 위젯 (홈 화면 + 잠금 화면)
//
// 설정:
//   1. 아래 DATA_URL 을 collect_usage.py --create-gist 가 출력한 URL로 교체
//   2. (비공개 gist인데 raw URL 접근이 안 될 때만) GITHUB_TOKEN 입력
//   3. 위젯 추가 → Script: 이 스크립트 선택
//      - 잠금 화면 원형 위젯: Parameter 에 "claude" 또는 "codex" 입력
// ─────────────────────────────────────────────────────────────

const DATA_URL = "https://gist.githubusercontent.com/YOUR_USER/YOUR_GIST_ID/raw/usage.json";
const GITHUB_TOKEN = ""; // 보통 비워둬도 됨

const COLOR_CLAUDE = new Color("#D97757"); // Anthropic 오렌지
const COLOR_CODEX = new Color("#10A37F");  // OpenAI 그린
const COLOR_BG_TOP = new Color("#1C1C1E");
const COLOR_BG_BOTTOM = new Color("#2C2C2E");
const COLOR_TEXT = Color.white();
const COLOR_SUBTEXT = new Color("#98989E");
const STALE_MINUTES = 90; // 이보다 오래된 데이터면 경고 표시

// ── 데이터 로드 ───────────────────────────────────────────────

async function loadData() {
  const cachePath = FileManager.local().joinPath(
    FileManager.local().cacheDirectory(), "usage-widget-cache.json");
  try {
    const req = new Request(DATA_URL + (DATA_URL.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (GITHUB_TOKEN) req.headers = { Authorization: "Bearer " + GITHUB_TOKEN };
    const data = await req.loadJSON();
    FileManager.local().writeString(cachePath, JSON.stringify(data));
    return data;
  } catch (e) {
    // 오프라인이면 마지막 캐시 사용
    if (FileManager.local().fileExists(cachePath)) {
      return JSON.parse(FileManager.local().readString(cachePath));
    }
    return null;
  }
}

function pct(tool, key) {
  const v = tool && tool[key];
  return typeof v === "number" ? Math.max(0, Math.min(100, v)) : null;
}

function fmtCost(usd) {
  if (typeof usd !== "number") return "-";
  return usd >= 100 ? "$" + usd.toFixed(0) : "$" + usd.toFixed(2);
}

function fmtTokens(n) {
  if (typeof n !== "number") return "-";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

function minutesSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  return isNaN(t) ? Infinity : (Date.now() - t) / 60000;
}

function barColor(p, base) {
  if (p === null) return COLOR_SUBTEXT;
  if (p >= 90) return new Color("#FF453A");
  if (p >= 70) return new Color("#FFD60A");
  return base;
}

// ── 그리기 유틸 ───────────────────────────────────────────────

function progressBarImage(p, width, height, color) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const bg = new Path();
  bg.addRoundedRect(new Rect(0, 0, width, height), height / 2, height / 2);
  ctx.addPath(bg);
  ctx.setFillColor(new Color("#48484A", 0.6));
  ctx.fillPath();
  if (p !== null && p > 0) {
    const w = Math.max(height, width * (p / 100));
    const fg = new Path();
    fg.addRoundedRect(new Rect(0, 0, w, height), height / 2, height / 2);
    ctx.addPath(fg);
    ctx.setFillColor(color);
    ctx.fillPath();
  }
  return ctx.getImage();
}

function ringImage(p, size, color, label) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const lineW = size / 9;
  const r = (size - lineW) / 2;
  const cx = size / 2, cy = size / 2;

  // 배경 원 + 진행 호를 짧은 선분으로 근사해 그림
  const drawArc = (fromDeg, toDeg, strokeColor) => {
    ctx.setStrokeColor(strokeColor);
    ctx.setLineWidth(lineW);
    const path = new Path();
    const steps = Math.max(2, Math.ceil((toDeg - fromDeg) / 4));
    for (let i = 0; i <= steps; i++) {
      const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) - 90) * Math.PI / 180;
      const pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a));
      if (i === 0) path.move(pt); else path.addLine(pt);
    }
    ctx.addPath(path);
    ctx.strokePath();
  };

  drawArc(0, 360, new Color("#787880", 0.45));
  if (p !== null && p > 0) drawArc(0, 360 * (p / 100), color);

  ctx.setTextAlignedCenter();
  ctx.setTextColor(COLOR_TEXT);
  ctx.setFont(Font.boldSystemFont(size * 0.26));
  ctx.drawTextInRect(p === null ? "-" : Math.round(p) + "", new Rect(0, cy - size * 0.24, size, size * 0.32));
  ctx.setFont(Font.mediumSystemFont(size * 0.15));
  ctx.setTextColor(COLOR_SUBTEXT);
  ctx.drawTextInRect(label, new Rect(0, cy + size * 0.08, size, size * 0.2));
  return ctx.getImage();
}

// ── 홈 화면 위젯 ─────────────────────────────────────────────

function addToolRow(widget, name, tool, accent, compact) {
  const p5 = pct(tool, "five_hour_pct");
  const pw = pct(tool, "weekly_pct");
  const today = (tool && tool.totals && tool.totals.today) || {};

  const header = widget.addStack();
  header.centerAlignContent();
  const dot = header.addText("●");
  dot.font = Font.systemFont(compact ? 8 : 10);
  dot.textColor = accent;
  header.addSpacer(4);
  const title = header.addText(name);
  title.font = Font.boldSystemFont(compact ? 12 : 14);
  title.textColor = COLOR_TEXT;
  header.addSpacer();
  const right = header.addText(
    p5 !== null ? Math.round(p5) + "%" : fmtCost(today.cost_usd));
  right.font = Font.boldSystemFont(compact ? 12 : 14);
  right.textColor = barColor(p5, accent);

  widget.addSpacer(3);
  const bar = widget.addImage(
    progressBarImage(p5 !== null ? p5 : 0, compact ? 130 : 290, 6, barColor(p5, accent)));
  bar.imageSize = new Size(compact ? 130 : 290, 6);

  widget.addSpacer(3);
  const sub = widget.addStack();
  const line = compact
    ? `주간 ${pw !== null ? Math.round(pw) + "%" : "-"} · ${fmtCost(today.cost_usd)}`
    : `5시간 ${p5 !== null ? Math.round(p5) + "%" : "-"} · 주간 ${pw !== null ? Math.round(pw) + "%" : "-"} · 오늘 ${fmtCost(today.cost_usd)} / ${fmtTokens(today.tokens)} tok`;
  const subText = sub.addText(line);
  subText.font = Font.systemFont(compact ? 9 : 11);
  subText.textColor = COLOR_SUBTEXT;
  subText.lineLimit = 1;
}

function buildHomeWidget(data, family) {
  const w = new ListWidget();
  const grad = new LinearGradient();
  grad.colors = [COLOR_BG_TOP, COLOR_BG_BOTTOM];
  grad.locations = [0, 1];
  w.backgroundGradient = grad;
  w.setPadding(12, 14, 12, 14);

  if (!data) {
    const t = w.addText("데이터 없음\ncollect_usage.py 실행 및\nDATA_URL 설정을 확인하세요");
    t.font = Font.systemFont(11);
    t.textColor = COLOR_SUBTEXT;
    return w;
  }

  const compact = family === "small";
  addToolRow(w, "Claude Code", data.claude, COLOR_CLAUDE, compact);
  w.addSpacer(compact ? 8 : 12);
  addToolRow(w, "Codex", data.codex, COLOR_CODEX, compact);
  w.addSpacer();

  const stale = minutesSince(data.updated_at) > STALE_MINUTES;
  const foot = w.addStack();
  foot.addSpacer();
  const updated = new Date(data.updated_at);
  const footText = foot.addText(
    (stale ? "⚠︎ " : "") +
    updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " 업데이트");
  footText.font = Font.systemFont(9);
  footText.textColor = stale ? new Color("#FFD60A") : COLOR_SUBTEXT;
  return w;
}

// ── 잠금 화면 위젯 ────────────────────────────────────────────

function buildLockRectangular(data) {
  const w = new ListWidget();
  if (!data) {
    w.addText("사용량 데이터 없음").font = Font.systemFont(12);
    return w;
  }
  for (const [name, tool] of [["CC", data.claude], ["CX", data.codex]]) {
    const p5 = pct(tool, "five_hour_pct");
    const pw = pct(tool, "weekly_pct");
    const row = w.addStack();
    row.centerAlignContent();
    const label = row.addText(name);
    label.font = Font.boldSystemFont(12);
    row.addSpacer(5);
    const img = row.addImage(progressBarImage(p5 !== null ? p5 : 0, 74, 5, Color.white()));
    img.imageSize = new Size(74, 5);
    row.addSpacer(5);
    const txt = row.addText(
      `${p5 !== null ? Math.round(p5) + "%" : "-"}·주${pw !== null ? Math.round(pw) + "%" : "-"}`);
    txt.font = Font.mediumSystemFont(11);
    txt.lineLimit = 1;
    if (name === "CC") w.addSpacer(4);
  }
  return w;
}

function buildLockCircular(data, param) {
  const w = new ListWidget();
  const useCodex = (param || "").toLowerCase().includes("codex");
  const tool = data ? (useCodex ? data.codex : data.claude) : null;
  const p5 = pct(tool, "five_hour_pct");
  const img = w.addImage(ringImage(p5, 120, Color.white(), useCodex ? "CX" : "CC"));
  img.centerAlignImage();
  return w;
}

function buildLockInline(data) {
  const w = new ListWidget();
  const c = pct(data && data.claude, "five_hour_pct");
  const x = pct(data && data.codex, "five_hour_pct");
  w.addText(`CC ${c !== null ? Math.round(c) + "%" : "-"} · CX ${x !== null ? Math.round(x) + "%" : "-"}`);
  return w;
}

// ── 메인 ─────────────────────────────────────────────────────

const data = await loadData();
const family = config.widgetFamily || "medium";
let widget;

if (family === "accessoryRectangular") {
  widget = buildLockRectangular(data);
} else if (family === "accessoryCircular") {
  widget = buildLockCircular(data, args.widgetParameter);
} else if (family === "accessoryInline") {
  widget = buildLockInline(data);
} else {
  widget = buildHomeWidget(data, family);
}

widget.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 갱신 요청

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  if (family === "medium" || family === "small") await widget.presentMedium();
  else await widget.presentMedium();
}
Script.complete();
