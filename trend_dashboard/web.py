"""소셜미디어 트렌드 대시보드 웹 서버.

로컬 실행:
    python -m trend_dashboard            # http://localhost:8100

환경변수:
    PORT             기본 8100 (섹터 에이전트의 8000과 겹치지 않게)
    APP_PASSWORD     설정 시 HTTP Basic 인증 요구 (공개 배포용)
    YOUTUBE_API_KEY  설정 시 YouTube 공식 API 사용 (미설정 시 페이지 파싱)
    TREND_CACHE_TTL  수집 결과 캐시 초 (기본 900 = 15분)
"""

from __future__ import annotations

import os
import secrets
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import HTMLResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from .sources import (
    REGIONS,
    TIKTOK_IMG_HOSTS,
    _http_get,
    cross_platform_keywords,
    fetch_google_trends,
    fetch_instagram,
    fetch_tiktok,
    fetch_youtube,
    now_iso,
)

APP_PASSWORD = os.environ.get("APP_PASSWORD", "")
CACHE_TTL = int(os.environ.get("TREND_CACHE_TTL", "900"))

app = FastAPI(title="소셜미디어 트렌드 대시보드")

_basic = HTTPBasic(auto_error=False)


# macOS 기본 파이썬(3.9) 호환을 위해 `X | None` 대신 Optional 사용
# (FastAPI가 이 시그니처를 실행 시점에 평가한다)
def require_auth(credentials: Optional[HTTPBasicCredentials] = Depends(_basic)) -> None:
    if not APP_PASSWORD:
        return
    if credentials is None or not secrets.compare_digest(credentials.password, APP_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비밀번호가 필요합니다.",
            headers={"WWW-Authenticate": "Basic"},
        )


_cache: dict[str, tuple[float, dict]] = {}
_cache_lock = threading.Lock()


def _collect(region: str) -> dict:
    yt_key = os.environ.get("YOUTUBE_API_KEY", "")
    tasks = [
        lambda: fetch_youtube(region, yt_key),
        lambda: fetch_tiktok(region),
        lambda: fetch_google_trends(region),
        lambda: fetch_instagram(region),
    ]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda f: f(), tasks))
    return {
        "region": region,
        "region_label": REGIONS[region]["label"],
        "generated_at": now_iso(),
        "cache_ttl": CACHE_TTL,
        "insights": cross_platform_keywords(results),
        "sources": [r.to_dict() for r in results],
    }


@app.get("/api/trends")
def trends(region: str = "kr", refresh: int = 0, _: None = Depends(require_auth)) -> dict:
    if region not in REGIONS:
        raise HTTPException(400, f"region은 {list(REGIONS)} 중 하나여야 합니다.")
    now = time.time()
    with _cache_lock:
        hit = _cache.get(region)
        if hit and not refresh and now - hit[0] < CACHE_TTL:
            return hit[1]
    data = _collect(region)
    with _cache_lock:
        _cache[region] = (now, data)
    return data


_IMG_TYPES = {b"\x89PNG": "image/png", b"RIFF": "image/webp", b"GIF8": "image/gif"}


@app.get("/api/img")
def img_proxy(u: str, _: None = Depends(require_auth)) -> Response:
    """리퍼러 제약이 있는 TikTok CDN 커버 이미지를 대신 받아서 전달한다."""
    host = urllib.parse.urlparse(u).hostname or ""
    if not u.startswith("https://") or not any(host.endswith(s) for s in TIKTOK_IMG_HOSTS):
        raise HTTPException(400, "허용되지 않은 이미지 호스트입니다.")
    try:
        data = _http_get(u, headers={"Referer": "https://www.tiktok.com/"}, timeout=15)
    except Exception as e:
        raise HTTPException(502, f"이미지를 가져오지 못했습니다: {e}")
    media_type = _IMG_TYPES.get(data[:4], "image/jpeg")
    return Response(content=data, media_type=media_type,
                    headers={"Cache-Control": "public, max-age=3600"})


INDEX_HTML = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>소셜미디어 트렌드 대시보드</title>
<style>
  :root {
    --bg: #0b0f1a; --panel: #131a2b; --panel2: #1a2338; --line: #263049;
    --text: #e8edf7; --muted: #8b96ad; --accent: #4f8cff;
    --yt: #ff4b4b; --tt: #22d3ce; --ig: #d858a8; --gg: #fbbf24;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif; }
  header { position: sticky; top: 0; z-index: 5; background: rgba(11,15,26,.92);
           backdrop-filter: blur(6px); border-bottom: 1px solid var(--line);
           padding: 14px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  header h1 { font-size: 1.05rem; margin: 0; letter-spacing: -.01em; }
  .tabs { display: flex; gap: 6px; background: var(--panel); border: 1px solid var(--line);
          border-radius: 10px; padding: 4px; }
  .tabs button { border: 0; background: transparent; color: var(--muted); padding: 7px 18px;
                 border-radius: 7px; font-size: .95rem; font-weight: 600; cursor: pointer; }
  .tabs button.on { background: var(--accent); color: #fff; }
  .spacer { flex: 1; }
  #meta { color: var(--muted); font-size: .8rem; }
  #refresh { border: 1px solid var(--line); background: var(--panel); color: var(--text);
             border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: .85rem; }
  #refresh:disabled { opacity: .5; cursor: wait; }
  main { max-width: 1320px; margin: 0 auto; padding: 20px; }

  #insights { background: linear-gradient(120deg, #16213c, #131a2b); border: 1px solid var(--line);
              border-radius: 14px; padding: 16px 18px; margin-bottom: 20px; }
  #insights h2 { margin: 0 0 4px; font-size: 1rem; }
  #insights p.sub { margin: 0 0 12px; color: var(--muted); font-size: .8rem; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: inline-flex; align-items: center; gap: 7px; background: var(--panel2);
          border: 1px solid var(--line); border-radius: 999px; padding: 6px 13px; font-size: .9rem; }
  .chip b { font-weight: 700; }
  .chip .n { color: var(--muted); font-size: .75rem; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot.youtube { background: var(--yt); } .dot.tiktok { background: var(--tt); }
  .dot.instagram { background: var(--ig); } .dot.google { background: var(--gg); }

  .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
          overflow: hidden; display: flex; flex-direction: column; min-height: 200px;
          grid-column: span 12; }
  @media (min-width: 980px) {
    .card.youtube { grid-column: span 7; }
    .card.tiktok { grid-column: span 5; }
    .card.google { grid-column: span 5; }
    .card.instagram { grid-column: span 7; }
  }
  .card > .head { display: flex; align-items: baseline; gap: 4px 8px; padding: 13px 16px 10px;
                  border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .card h2 { font-size: .95rem; margin: 0; display: flex; align-items: center; gap: 8px;
             white-space: nowrap; }
  .badge { font-size: .68rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; color: #0b0f1a; }
  .badge.youtube { background: var(--yt); color: #fff; } .badge.tiktok { background: var(--tt); }
  .badge.instagram { background: var(--ig); color: #fff; } .badge.google { background: var(--gg); }
  .card .note { flex: 1; min-width: 130px; color: var(--muted); font-size: .7rem; text-align: right; }

  /* 해시태그 칩 스트립 (틱톡 카드 상단) */
  .chipsrow { display: flex; gap: 6px; overflow-x: auto; padding: 10px 14px 2px;
              scrollbar-width: thin; }
  .chipsrow a { white-space: nowrap; font-size: .76rem; color: var(--text);
                background: var(--panel2); border: 1px solid var(--line); border-radius: 999px;
                padding: 3px 11px; text-decoration: none; }
  .chipsrow a:hover { border-color: var(--accent); color: var(--accent); }

  /* 미디어 그리드 (영상·사진 타일) */
  .mgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
           padding: 14px; overflow-y: auto; max-height: 640px; }
  .mgrid.vertical { grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 560px) { .mgrid, .mgrid.vertical { grid-template-columns: repeat(2, 1fr); } }
  .tile { cursor: pointer; min-width: 0; }
  .tile .th { position: relative; border-radius: 9px; overflow: hidden;
              aspect-ratio: 16/9; background: var(--panel2); }
  .mgrid.vertical .tile .th { aspect-ratio: 9/16; }
  .tile img { width: 100%; height: 100%; object-fit: cover; display: block;
              transition: transform .18s; }
  .tile:hover img { transform: scale(1.05); }
  .tile .play { position: absolute; inset: 0; display: flex; align-items: center;
                justify-content: center; background: rgba(0,0,0,.35); opacity: 0;
                transition: opacity .15s; }
  .tile:hover .play { opacity: 1; }
  .tile .play span { width: 46px; height: 46px; border-radius: 50%; background: rgba(255,255,255,.92);
                     color: #111; display: flex; align-items: center; justify-content: center;
                     font-size: 1.1rem; padding-left: 4px; }
  .tile .rk { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,.65); color: #fff;
              font-size: .7rem; font-weight: 700; border-radius: 6px; padding: 2px 7px; }
  .tile .tt { font-size: .82rem; line-height: 1.35; margin: 7px 2px 0; overflow: hidden;
              display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tile .tm { color: var(--muted); font-size: .72rem; margin: 3px 2px 0; overflow: hidden;
              text-overflow: ellipsis; white-space: nowrap; }

  /* 텍스트/뉴스 리스트 */
  .card ol { list-style: none; margin: 0; padding: 6px 0; overflow-y: auto; max-height: 640px; }
  .card li { display: flex; gap: 10px; padding: 8px 16px; align-items: flex-start; }
  .card li:hover { background: var(--panel2); }
  .rank { color: var(--muted); font-size: .8rem; font-weight: 700; min-width: 20px;
          text-align: right; padding-top: 2px; }
  .rank.top { color: var(--accent); }
  li img { width: 92px; height: 60px; object-fit: cover; border-radius: 7px; flex: none;
           cursor: pointer; background: var(--panel2); }
  .t { flex: 1; min-width: 0; }
  .t a { color: var(--text); text-decoration: none; font-size: .88rem; line-height: 1.35;
         overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2;
         -webkit-box-orient: vertical; }
  .t a:hover { color: var(--accent); }
  .t .m { color: var(--muted); font-size: .74rem; margin-top: 3px; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap; }
  .err { padding: 24px 16px; color: var(--muted); font-size: .84rem; line-height: 1.6; }
  .skeleton { padding: 16px; }
  .skeleton div { height: 14px; border-radius: 6px; background: var(--panel2);
                  margin: 12px 0; animation: pulse 1.2s infinite; }
  @keyframes pulse { 50% { opacity: .45; } }
  footer { color: var(--muted); font-size: .74rem; text-align: center; padding: 24px; line-height: 1.7; }

  /* 임베드 플레이어 모달 */
  #player { position: fixed; inset: 0; background: rgba(3,6,14,.85); z-index: 50;
            display: flex; align-items: center; justify-content: center; padding: 20px; }
  #player[hidden] { display: none; }
  #player .pbox { position: relative; width: min(920px, 94vw); aspect-ratio: 16/9; }
  #player.vertical .pbox { width: auto; height: min(760px, 88vh); aspect-ratio: 9/16; }
  #player iframe { width: 100%; height: 100%; border: 0; border-radius: 12px; background: #000; }
  .pclose { position: absolute; top: -40px; right: 0; background: none; border: 0;
            color: #fff; font-size: 1.5rem; cursor: pointer; line-height: 1; }
</style>
</head>
<body>
<header>
  <h1>📊 소셜미디어 트렌드</h1>
  <div class="tabs">
    <button id="tab-kr" class="on" onclick="setRegion('kr')">🇰🇷 국내</button>
    <button id="tab-global" onclick="setRegion('global')">🌍 해외</button>
  </div>
  <div class="spacer"></div>
  <span id="meta"></span>
  <button id="refresh" onclick="load(true)">↻ 새로고침</button>
</header>

<main>
  <section id="insights" hidden>
    <h2>🔥 크로스 플랫폼 핫 키워드</h2>
    <p class="sub">여러 플랫폼에서 동시에 등장하는 키워드 — 지금 종합적으로 가장 뜨는 주제입니다.</p>
    <div class="chips" id="chips"></div>
  </section>
  <div class="grid" id="grid"></div>
</main>

<div id="player" hidden>
  <div class="pbox">
    <button class="pclose" onclick="closePlayer()" aria-label="닫기">✕</button>
    <iframe id="pframe" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen></iframe>
  </div>
</div>

<footer>
  YouTube 인기 급상승 · TikTok 크리에이티브 센터 · Google 실시간 검색 트렌드 · Instagram 관련 뉴스(Google News)<br>
  영상 타일을 클릭하면 페이지 안에서 바로 재생됩니다. Instagram은 공개 트렌드 API가 없어 뉴스 기반으로 집계됩니다.
</footer>

<script>
let region = 'kr';
const PLATFORM_ORDER = ['youtube', 'tiktok', 'google', 'instagram'];
const PLATFORM_NAME = {youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', google: 'Google'};
const $ = (id) => document.getElementById(id);

function setRegion(r) {
  region = r;
  $('tab-kr').classList.toggle('on', r === 'kr');
  $('tab-global').classList.toggle('on', r === 'global');
  load(false);
}

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function skeletonCards() {
  $('insights').hidden = true;
  $('grid').innerHTML = PLATFORM_ORDER.map(p =>
    `<div class="card ${p}"><div class="skeleton">${'<div></div>'.repeat(6)}</div></div>`).join('');
}

function cardHead(s) {
  return `<div class="head"><h2><span class="badge ${s.platform}">${PLATFORM_NAME[s.platform]}</span>${
    esc(s.label)}</h2><span class="note">${esc(s.note)}</span></div>`;
}

// 미디어 타일 (유튜브·틱톡 영상) — 클릭하면 임베드 재생, 임베드가 없으면 새 탭
function mediaGrid(s, vertical) {
  const tiles = s.items.map(it => `
    <div class="tile" data-embed="${esc(it.embed)}" data-url="${esc(it.url)}"
         data-vert="${vertical ? 1 : 0}">
      <div class="th">
        <img src="${esc(it.thumbnail)}" loading="lazy" alt=""
             onerror="this.parentElement.parentElement.style.display='none'">
        <span class="rk">${it.rank}</span>
        <div class="play"><span>▶</span></div>
      </div>
      <div class="tt">${esc(it.title)}</div>
      <div class="tm">${esc([it.metric, it.extra].filter(Boolean).join(' · '))}</div>
    </div>`).join('');
  return `<div class="mgrid ${vertical ? 'vertical' : ''}">${tiles}</div>`;
}

function chipsRow(chips) {
  if (!chips || !chips.length) return '';
  return `<div class="chipsrow">${chips.map(c =>
    `<a href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.metric)}">${esc(c.title)}</a>`
  ).join('')}</div>`;
}

// 텍스트/뉴스 리스트 (구글 트렌드·인스타그램 소식) — 썸네일이 있으면 함께 표시
function newsList(s) {
  const lis = s.items.map(it => `
    <li>
      <span class="rank ${it.rank <= 3 ? 'top' : ''}">${it.rank}</span>
      ${it.thumbnail ? `<img src="${esc(it.thumbnail)}" loading="lazy" alt=""
          data-embed="${esc(it.embed)}" data-url="${esc(it.url)}" data-vert="1"
          onerror="this.remove()">` : ''}
      <div class="t">
        <a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>
        <div class="m">${esc([it.metric, it.extra].filter(Boolean).join(' · '))}</div>
      </div>
    </li>`).join('');
  return `<ol>${lis}</ol>`;
}

function renderSource(s) {
  const head = cardHead(s);
  if (s.error && !s.items.length) {
    return `<div class="card ${s.platform}">${head}<div class="err">⚠️ ${esc(s.error)}<br>
      네트워크/차단 문제일 수 있습니다. 잠시 후 새로고침 해보세요.</div></div>`;
  }
  let body;
  const hasMedia = s.items.some(it => it.thumbnail);
  if (s.platform === 'youtube' && hasMedia) {
    body = mediaGrid(s, false);
  } else if (s.platform === 'tiktok' && hasMedia) {
    body = chipsRow(s.chips) + mediaGrid(s, true);
  } else {
    body = chipsRow(s.chips) + newsList(s);
  }
  return `<div class="card ${s.platform}">${head}${body}</div>`;
}

function renderInsights(insights) {
  if (!insights.length) { $('insights').hidden = true; return; }
  $('insights').hidden = false;
  $('chips').innerHTML = insights.map(k => `
    <span class="chip">
      ${k.platforms.map(p => `<span class="dot ${p}"></span>`).join('')}
      <b>${esc(k.keyword)}</b><span class="n">×${k.count}</span>
    </span>`).join('');
}

function openPlayer(embed, vertical) {
  $('player').classList.toggle('vertical', !!vertical);
  $('pframe').src = embed;
  $('player').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closePlayer() {
  $('pframe').src = '';
  $('player').hidden = true;
  document.body.style.overflow = '';
}

// 타일/썸네일 클릭 → 임베드 재생 (없으면 새 탭)
document.addEventListener('click', (e) => {
  if (e.target === $('player')) { closePlayer(); return; }
  const el = e.target.closest('[data-embed], [data-url]');
  if (!el || e.target.closest('a')) return;
  const embed = el.dataset.embed;
  if (embed) openPlayer(embed, el.dataset.vert === '1');
  else if (el.dataset.url) window.open(el.dataset.url, '_blank', 'noopener');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlayer(); });

async function load(force) {
  const btn = $('refresh');
  btn.disabled = true;
  skeletonCards();
  $('meta').textContent = '수집 중… (최대 30초)';
  try {
    const res = await fetch(`/api/trends?region=${region}${force ? '&refresh=1' : ''}`);
    if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
    const data = await res.json();
    const order = Object.fromEntries(PLATFORM_ORDER.map((p, i) => [p, i]));
    data.sources.sort((a, b) => order[a.platform] - order[b.platform]);
    $('grid').innerHTML = data.sources.map(renderSource).join('');
    renderInsights(data.insights);
    const t = new Date(data.generated_at);
    $('meta').textContent = `${data.region_label} · ${t.toLocaleTimeString('ko-KR')} 수집`;
  } catch (e) {
    $('grid').innerHTML = `<div class="card"><div class="err">❌ ${esc(e.message)}</div></div>`;
    $('meta').textContent = '';
  } finally {
    btn.disabled = false;
  }
}

load(false);
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def index(_: None = Depends(require_auth)) -> str:
    return INDEX_HTML


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8100"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
