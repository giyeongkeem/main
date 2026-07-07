"""플랫폼별 트렌드 수집기 — 전부 API 키 없이 동작한다 (YouTube는 키가 있으면 공식 API 사용).

수집 소스:
  - YouTube  : 인기 급상승 페이지(ytInitialData) 파싱. YOUTUBE_API_KEY가 있으면
               공식 Data API(mostPopular)로 대체 (더 안정적).
               썸네일은 i.ytimg.com 규칙 URL, 재생은 youtube.com/embed 임베드.
  - TikTok   : 크리에이티브 센터의 인기 '영상'(커버 이미지 + embed/v2 재생)과
               인기 해시태그(칩). 영상 수집이 막히면 해시태그 목록으로 폴백.
  - Google   : 실시간 검색 트렌드 RSS (관련 이미지 포함).
  - Instagram: 공개 트렌드 API가 없어 Google News RSS에서 릴스/트렌드 관련
               기사를 모으고, 기사 원문의 og:image로 사진을 붙인다.
               기사가 인스타그램 게시물 링크면 임베드로 바로 재생/표시.

각 수집기는 실패해도 예외를 밖으로 던지지 않고 SourceResult.error에 담아
대시보드가 부분적으로라도 항상 뜨게 한다.
"""

from __future__ import annotations

import base64
import gzip
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

MAX_ITEMS = 20

# region 코드 → 플랫폼별 파라미터
REGIONS = {
    "kr": {"label": "국내", "gl": "KR", "hl": "ko", "news_hl": "ko", "news_gl": "KR"},
    "global": {"label": "해외", "gl": "US", "hl": "en", "news_hl": "en", "news_gl": "US"},
}


@dataclass
class TrendItem:
    title: str
    url: str = ""
    metric: str = ""      # 조회수·게시물 수·검색량 등
    extra: str = ""       # 채널명·언론사·관련 기사 등
    thumbnail: str = ""
    embed: str = ""       # 있으면 클릭 시 페이지 안에서 바로 재생
    rank: int = 0


@dataclass
class SourceResult:
    platform: str         # youtube | tiktok | instagram | google
    region: str           # kr | global
    label: str
    items: list[TrendItem] = field(default_factory=list)
    chips: list[dict] = field(default_factory=list)   # 보조 목록 (예: 틱톡 해시태그)
    error: str = ""
    note: str = ""

    def to_dict(self) -> dict:
        return {
            "platform": self.platform,
            "region": self.region,
            "label": self.label,
            "error": self.error,
            "note": self.note,
            "chips": self.chips,
            "items": [vars(i) for i in self.items],
        }


def _http_get(url: str, headers: dict | None = None, timeout: int = 20) -> bytes:
    h = {"User-Agent": _UA, "Accept-Language": "ko,en;q=0.8"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        if resp.headers.get("Content-Encoding") == "gzip" or data[:2] == b"\x1f\x8b":
            data = gzip.decompress(data)
        return data


def _fmt_count(n: int | float | None) -> str:
    """1234567 -> '123.5만' 처럼 한국식 단위로 축약."""
    if not n:
        return ""
    n = float(n)
    if n >= 1e8:
        return f"{n / 1e8:.1f}억".replace(".0억", "억")
    if n >= 1e4:
        return f"{n / 1e4:.1f}만".replace(".0만", "만")
    if n >= 1e3:
        return f"{n / 1e3:.1f}천".replace(".0천", "천")
    return f"{int(n)}"


# ---------------------------------------------------------------- YouTube

def _extract_yt_initial_data(html: str) -> dict:
    for marker in ("var ytInitialData = ", 'window["ytInitialData"] = '):
        pos = html.find(marker)
        if pos != -1:
            start = html.index("{", pos)
            obj, _ = json.JSONDecoder().raw_decode(html[start:])
            return obj
    raise ValueError("ytInitialData를 찾지 못했습니다 (페이지 구조 변경 가능성).")


def _walk_video_renderers(node) -> list[dict]:
    """ytInitialData 트리에서 videoRenderer 객체를 순서대로 수집."""
    found: list[dict] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key in ("videoRenderer", "gridVideoRenderer") and isinstance(value, dict):
                found.append(value)
            else:
                found.extend(_walk_video_renderers(value))
    elif isinstance(node, list):
        for value in node:
            found.extend(_walk_video_renderers(value))
    return found


def _yt_text(obj: dict | None) -> str:
    if not isinstance(obj, dict):
        return ""
    if "simpleText" in obj:
        return obj["simpleText"]
    runs = obj.get("runs") or []
    return "".join(r.get("text", "") for r in runs)


def _yt_item(vid: str, title: str, metric: str, extra: str, rank: int) -> TrendItem:
    # 썸네일/임베드는 videoId로 규칙적으로 만들 수 있어 항상 연동된다.
    return TrendItem(
        title=title,
        url=f"https://www.youtube.com/watch?v={vid}",
        metric=metric,
        extra=extra,
        thumbnail=f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
        embed=f"https://www.youtube.com/embed/{vid}?autoplay=1",
        rank=rank,
    )


def fetch_youtube(region: str, api_key: str = "") -> SourceResult:
    r = SourceResult("youtube", region, "YouTube 인기 급상승")
    p = REGIONS[region]
    try:
        if api_key:
            r.items = _youtube_via_api(p["gl"], api_key)
            r.note = "YouTube Data API 기준 · 클릭하면 바로 재생"
        else:
            r.items = _youtube_via_scrape(p["gl"], p["hl"])
            r.note = "인기 급상승 기준 · 클릭하면 바로 재생"
        if not r.items:
            r.error = "인기 동영상을 찾지 못했습니다 (페이지 구조 변경 가능성)."
    except Exception as e:
        r.error = f"수집 실패: {e}"
    return r


def _youtube_via_scrape(gl: str, hl: str) -> list[TrendItem]:
    url = f"https://www.youtube.com/feed/trending?gl={gl}&hl={hl}"
    html = _http_get(url, headers={"Cookie": "CONSENT=YES+cb; SOCS=CAI"}).decode("utf-8", "replace")
    data = _extract_yt_initial_data(html)
    items: list[TrendItem] = []
    seen: set[str] = set()
    for v in _walk_video_renderers(data):
        vid = v.get("videoId", "")
        title = _yt_text(v.get("title"))
        if not vid or not title or vid in seen:
            continue
        seen.add(vid)
        views = _yt_text(v.get("shortViewCountText")) or _yt_text(v.get("viewCountText"))
        channel = _yt_text(v.get("ownerText")) or _yt_text(v.get("shortBylineText"))
        published = _yt_text(v.get("publishedTimeText"))
        items.append(_yt_item(
            vid, title, views,
            " · ".join(x for x in (channel, published) if x),
            len(items) + 1,
        ))
        if len(items) >= MAX_ITEMS:
            break
    return items


def _youtube_via_api(gl: str, api_key: str) -> list[TrendItem]:
    q = urllib.parse.urlencode({
        "part": "snippet,statistics", "chart": "mostPopular",
        "regionCode": gl, "maxResults": MAX_ITEMS, "key": api_key,
    })
    data = json.loads(_http_get(f"https://www.googleapis.com/youtube/v3/videos?{q}"))
    items: list[TrendItem] = []
    for i, v in enumerate(data.get("items", []), 1):
        sn, st = v.get("snippet", {}), v.get("statistics", {})
        views = _fmt_count(int(st.get("viewCount", 0)))
        items.append(_yt_item(
            v.get("id", ""), sn.get("title", ""),
            f"조회수 {views}회" if views else "",
            sn.get("channelTitle", ""), i,
        ))
    return items


# ---------------------------------------------------------------- TikTok

_TT_HEADERS = {
    "Referer": "https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en",
    "Accept": "application/json",
}
# 크리에이티브 센터 CDN 커버는 리퍼러/만료 제약이 있어 서버 프록시(/api/img)로 우회한다.
TIKTOK_IMG_HOSTS = (".tiktokcdn.com", ".tiktokcdn-us.com", ".ttwstatic.com",
                    ".ibyteimg.com", ".byteimg.com")


def _tiktok_api(path: str, params: dict) -> dict:
    url = f"https://ads.tiktok.com/creative_radar_api/v1/{path}?{urllib.parse.urlencode(params)}"
    data = json.loads(_http_get(url, headers=_TT_HEADERS))
    if data.get("code") != 0:
        raise ValueError(data.get("msg") or f"API 응답 코드 {data.get('code')}")
    return data.get("data") or {}


def _proxy_img(url: str) -> str:
    if not url:
        return ""
    host = urllib.parse.urlparse(url).hostname or ""
    if any(host.endswith(sfx) for sfx in TIKTOK_IMG_HOSTS):
        return "/api/img?u=" + urllib.parse.quote(url, safe="")
    return url


def _tt_video_item(v: dict, rank: int) -> TrendItem | None:
    vid = str(v.get("item_id") or v.get("id") or "")
    cover = v.get("cover_url") or v.get("cover") or v.get("origin_cover") or ""
    if isinstance(cover, list):
        cover = cover[0] if cover else ""
    title = (v.get("title") or v.get("desc") or "").strip() or "TikTok 인기 영상"
    link = v.get("tt_link") or v.get("item_url") or v.get("share_url") or ""
    if not link and vid:
        link = f"https://www.tiktok.com/embed/v2/{vid}"
    if not (vid or link):
        return None
    views = _fmt_count(v.get("vv") or v.get("video_views") or v.get("play_count"))
    return TrendItem(
        title=title,
        url=link,
        metric=f"조회 {views}" if views else "",
        thumbnail=_proxy_img(cover),
        embed=f"https://www.tiktok.com/embed/v2/{vid}" if vid else "",
        rank=rank,
    )


def fetch_tiktok(region: str) -> SourceResult:
    r = SourceResult("tiktok", region, "TikTok 인기 영상",
                     note="크리에이티브 센터 · 최근 7일 · 클릭하면 바로 재생")
    p = REGIONS[region]
    base = {"page": 1, "limit": MAX_ITEMS, "period": 7, "country_code": p["gl"]}

    # 인기 해시태그 → 카드 상단 칩
    tag_err = ""
    try:
        data = _tiktok_api("popular_trend/hashtag/list", {**base, "sort_by": "popular"})
        for h in data.get("list") or []:
            name = h.get("hashtag_name", "")
            if not name:
                continue
            views = _fmt_count(h.get("video_views"))
            r.chips.append({
                "title": f"#{name}",
                "url": f"https://www.tiktok.com/tag/{urllib.parse.quote(name)}",
                "metric": f"조회 {views}" if views else "",
            })
    except Exception as e:
        tag_err = str(e)

    # 인기 영상 (엔드포인트가 여러 번 바뀌어 후보를 순서대로 시도)
    vid_errs = []
    for path in ("popular_trend/video/list", "popular_trend/list"):
        try:
            data = _tiktok_api(path, {**base, "order_by": "vv"})
            raw = data.get("videos") or data.get("list") or data.get("items") or []
            items = [it for i, v in enumerate(raw, 1) if (it := _tt_video_item(v, i))]
            if items:
                r.items = items[:MAX_ITEMS]
                break
        except Exception as e:
            vid_errs.append(f"{path}: {e}")

    if not r.items:
        if r.chips:
            # 영상 수집이 막히면 해시태그를 본문 목록으로 보여준다.
            r.label = "TikTok 인기 해시태그"
            r.note = "크리에이티브 센터 · 최근 7일 기준 (영상 목록은 일시적으로 수집 불가)"
            r.items = [TrendItem(title=c["title"], url=c["url"], metric=c["metric"], rank=i)
                       for i, c in enumerate(r.chips, 1)]
            r.chips = []
        else:
            r.error = "수집 실패: " + "; ".join(vid_errs + ([tag_err] if tag_err else []))[:300]
    return r


# ---------------------------------------------------------------- Google 검색 트렌드

def fetch_google_trends(region: str) -> SourceResult:
    r = SourceResult("google", region, "Google 실시간 검색 트렌드",
                     note="지금 급상승 중인 검색어")
    p = REGIONS[region]
    url = f"https://trends.google.com/trending/rss?geo={p['gl']}"
    try:
        root = ET.fromstring(_http_get(url))
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            traffic, picture, news_title, news_url = "", "", "", ""
            for child in item:
                tag = child.tag.rsplit("}", 1)[-1]
                if tag == "approx_traffic" and child.text:
                    traffic = child.text.strip()
                elif tag == "picture" and child.text:
                    picture = child.text.strip()
                elif tag == "news_item" and not news_title:
                    for sub in child:
                        stag = sub.tag.rsplit("}", 1)[-1]
                        if stag == "news_item_title" and sub.text:
                            news_title = sub.text.strip()
                        elif stag == "news_item_url" and sub.text:
                            news_url = sub.text.strip()
                        elif stag == "news_item_picture" and sub.text and not picture:
                            picture = sub.text.strip()
            r.items.append(TrendItem(
                title=title,
                url=news_url or "https://www.google.com/search?q=" + urllib.parse.quote(title),
                metric=f"검색량 {traffic}" if traffic else "",
                extra=news_title,
                thumbnail=picture,
                rank=len(r.items) + 1,
            ))
            if len(r.items) >= MAX_ITEMS:
                break
        if not r.items:
            r.error = "트렌드 항목이 비어 있습니다."
    except Exception as e:
        r.error = f"수집 실패: {e}"
    return r


# ---------------------------------------------------------------- Instagram (뉴스 기반)

_IG_QUERY = {
    "kr": "인스타그램 (릴스 OR 트렌드 OR 챌린지 OR 밈 OR 인기) when:7d",
    "global": 'Instagram (Reels OR trend OR trending OR viral OR meme) when:7d',
}

_IG_POST_RE = re.compile(r"instagram\.com/(?:p|reel|reels|tv)/[\w-]+")


def _decode_gnews_url(link: str) -> str:
    """Google News RSS의 리다이렉트 링크에서 원문 기사 URL을 복원한다 (가능한 경우)."""
    m = re.search(r"news\.google\.com/(?:rss/)?articles/([^?/&]+)", link)
    if not m:
        return link
    token = m.group(1)
    try:
        raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
        urls = re.findall(rb"https?://[ -~]+?(?=[^ -~]|$)", raw)
        for u in urls:
            s = u.decode("ascii", "ignore")
            if "google.com" not in s:
                return s
    except Exception:
        pass
    return link


def _og_image(url: str) -> str:
    """기사 페이지의 og:image를 가져온다 (실패 시 빈 문자열)."""
    try:
        html = _http_get(url, timeout=8).decode("utf-8", "replace")
        m = (re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html)
             or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image', html))
        return m.group(1).strip() if m else ""
    except Exception:
        return ""


def fetch_instagram(region: str) -> SourceResult:
    r = SourceResult("instagram", region, "Instagram 트렌드 소식",
                     note="공개 트렌드 API가 없어 최근 7일 관련 뉴스·게시물로 집계")
    p = REGIONS[region]
    q = urllib.parse.quote(_IG_QUERY[region])
    hl, gl = p["news_hl"], p["news_gl"]
    url = f"https://news.google.com/rss/search?q={q}&hl={hl}&gl={gl}&ceid={gl}:{hl}"
    try:
        root = ET.fromstring(_http_get(url))
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            src = item.find("source")
            link = _decode_gnews_url((item.findtext("link") or "").strip())
            r.items.append(TrendItem(
                title=title,
                url=link,
                extra=(src.text.strip() if src is not None and src.text else ""),
                metric=(item.findtext("pubDate") or "").strip()[:16],
                rank=len(r.items) + 1,
            ))
            if len(r.items) >= 10:
                break

        # 기사 원문에서 대표 이미지(og:image)를 병렬로 가져와 사진을 붙인다.
        decodable = [it for it in r.items if "news.google.com" not in it.url]
        if decodable:
            with ThreadPoolExecutor(max_workers=6) as pool:
                for it, img in zip(decodable, pool.map(lambda i: _og_image(i.url), decodable)):
                    it.thumbnail = img
                    m = _IG_POST_RE.search(it.url)
                    if m:
                        it.embed = f"https://{m.group(0)}/embed"
        if not r.items:
            r.error = "관련 뉴스를 찾지 못했습니다."
    except Exception as e:
        r.error = f"수집 실패: {e}"
    return r


# ---------------------------------------------------------------- 종합 키워드 인사이트

_STOPWORDS = {
    # ko
    "있다", "없다", "한다", "했다", "된다", "됐다", "위해", "대한", "관련", "오늘",
    "영상", "공개", "출시", "발표", "이유", "방법", "논란", "근황", "화제", "최초",
    # en
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is",
    "are", "was", "how", "why", "what", "new", "video", "official", "trailer",
    "this", "that", "you", "your", "from", "his", "her", "its", "will", "has",
    # 플랫폼명 자체는 인사이트가 아님
    "youtube", "tiktok", "instagram", "shorts", "reels", "유튜브", "틱톡",
    "인스타그램", "인스타", "릴스", "쇼츠",
}

_TOKEN_RE = re.compile(r"[#\w가-힣]+")


def _keywords_of(text: str) -> set[str]:
    out = set()
    for tok in _TOKEN_RE.findall(text):
        tok = tok.lstrip("#").lower()
        if len(tok) < 2 or tok.isdigit() or tok in _STOPWORDS:
            continue
        out.add(tok)
    return out


def cross_platform_keywords(sources: list[SourceResult], top: int = 14) -> list[dict]:
    """여러 플랫폼에서 동시에 등장하는 키워드를 뽑아 '지금 진짜 뜨는 것'을 추린다."""
    freq: dict[str, int] = {}
    platforms: dict[str, set[str]] = {}
    for s in sources:
        texts = [f"{i.title} {i.extra}" for i in s.items] + [c["title"] for c in s.chips]
        for text in texts:
            for kw in _keywords_of(text):
                freq[kw] = freq.get(kw, 0) + 1
                platforms.setdefault(kw, set()).add(s.platform)
    ranked = sorted(
        freq,
        key=lambda k: (len(platforms[k]), freq[k]),
        reverse=True,
    )
    out = []
    for kw in ranked:
        if len(platforms[kw]) < 2 and freq[kw] < 3:
            continue
        out.append({
            "keyword": kw,
            "count": freq[kw],
            "platforms": sorted(platforms[kw]),
        })
        if len(out) >= top:
            break
    return out


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
