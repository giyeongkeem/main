"""무료 뉴스 수집 — Google News RSS 기반 (API 키 불필요).

로컬 LLM(ollama)은 웹 검색 도구가 없으므로, 섹터별 키워드로 Google News RSS를
조회해 최근 기사 제목·출처·링크를 모아 모델에 컨텍스트로 제공한다.
"""

from __future__ import annotations

import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass

from .config import Config, Sector

_UA = "Mozilla/5.0 (compatible; sector-news-agent/0.1)"


@dataclass
class NewsItem:
    title: str
    source: str
    link: str
    published: str


def _rss_url(sector: Sector, days: int, hl: str, gl: str) -> str:
    # 섹터명 + 키워드 일부를 OR 쿼리로. when:Nd 로 최근 기간 제한.
    terms = [sector.name, *sector.keywords[:4]]
    query = " OR ".join(f'"{t}"' for t in terms) + f" when:{days}d"
    q = urllib.parse.quote(query)
    ceid = f"{gl}:{hl}"
    return f"https://news.google.com/rss/search?q={q}&hl={hl}&gl={gl}&ceid={ceid}"


def fetch_sector_news(sector: Sector, cfg: Config) -> list[NewsItem]:
    """섹터의 최근 뉴스 항목을 Google News RSS에서 가져온다 (실패 시 빈 리스트)."""
    hl, gl = ("ko", "KR") if sector.region == "domestic" else ("en", "US")
    url = _rss_url(sector, cfg.news_days, hl, gl)
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    with urllib.request.urlopen(req, timeout=20) as resp:
        root = ET.fromstring(resp.read())

    items: list[NewsItem] = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        src_el = item.find("source")
        source = (src_el.text.strip() if src_el is not None and src_el.text else "")
        if title:
            items.append(NewsItem(title=title, source=source, link=link, published=pub))
        if len(items) >= cfg.news_max_items:
            break
    return items


def format_news(items: list[NewsItem]) -> str:
    """수집된 뉴스를 LLM 프롬프트용 텍스트로 변환."""
    if not items:
        return "(수집된 뉴스가 없습니다. 일반적 시장 지식으로 작성하세요.)"
    lines = []
    for i, n in enumerate(items, 1):
        meta = " · ".join(x for x in (n.source, n.published) if x)
        lines.append(f"{i}. {n.title}" + (f"  [{meta}]" if meta else ""))
        if n.link:
            lines.append(f"   출처: {n.link}")
    return "\n".join(lines)
