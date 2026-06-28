"""섹터별 이슈 수집 → 종합 투자 리포트 생성 파이프라인.

백엔드에 따라 뉴스 수집 방식이 다르다:
- Claude API: 모델이 서버사이드 web_search로 직접 뉴스를 수집한다.
- 로컬 Ollama: news.py가 Google News RSS로 무료 수집한 기사를 모델에 넣는다.

progress 콜백(kind, message)으로 진행 상황을 전달한다.
kind: "status"(단계 전환) | "tool"(도구 실행) | "text"(생성 텍스트 델타)
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Callable
from zoneinfo import ZoneInfo

from .backends import make_backend
from .config import Config, Sector
from .news import fetch_sector_news, format_news

ProgressFn = Callable[[str, str], None]

RESEARCH_SYSTEM = """\
당신은 한국 기관투자자 리서치팀의 섹터 애널리스트입니다.
주어진 주식 섹터의 최근 주요 이슈를 정리하고, 투자 판단에 필요한 핵심만 추립니다.

원칙:
- 최근 1주일 이내 뉴스를 우선하되, 진행 중인 구조적 이슈(규제, 수급, 기술 변화)도 포함합니다.
- 사실(뉴스)과 해석(시장 반응, 전망)을 구분해 서술합니다.
- 수치(주가 변동률, 실적, 수주 금액 등)는 가능한 한 구체적으로 인용합니다.
- 각 이슈에 출처(매체명, 가능하면 URL)를 남깁니다.
- 확인되지 않은 루머는 '미확인'으로 명시합니다.
- 한국어로 작성합니다.
"""

SYNTHESIS_SYSTEM = """\
당신은 한국 기관투자자 대상 데일리 마켓 리포트를 쓰는 수석 애널리스트입니다.
섹터별 리서치 브리핑을 받아 하나의 종합 리포트를 작성합니다.

리포트 구조 (Markdown):
1. **오늘의 핵심 요약** — 전체 섹터를 관통하는 3~5개 헤드라인
2. **국내 섹터** — 섹터별 주요 이슈, 시장 반응, 주목할 종목
3. **해외 섹터** — 동일 구조, 국내 시장에 미치는 영향 포함
4. **투자 관점** — 섹터별 단기(1주~1개월) / 중기(1~6개월) 시각, 긍정·부정 요인
5. **리스크 요인** — 시나리오를 바꿀 수 있는 이벤트와 일정
6. **출처** — 브리핑에 인용된 주요 출처 목록

원칙:
- 브리핑에 없는 사실을 만들어내지 않습니다.
- 매수/매도 추천이 아닌 관점과 근거를 제시합니다.
- 리포트 말미에 "본 리포트는 정보 제공 목적이며 투자 권유가 아닙니다." 면책 문구를 넣습니다.
- 한국어로 작성합니다.
"""


def _default_progress(kind: str, message: str) -> None:
    if kind == "text":
        print(message, end="", flush=True, file=sys.stderr)
    else:
        print(f"\n{message}", file=sys.stderr)


def research_sector(backend, cfg: Config, sector: Sector, today: str, progress: ProgressFn) -> str:
    """단일 섹터의 최근 이슈를 수집해 브리핑 텍스트를 반환한다."""
    keywords = ", ".join(sector.keywords) if sector.keywords else "(없음)"

    if backend.fetches_own_news:
        # Claude: 모델이 직접 웹 검색
        news_block = (
            "위 섹터의 최근 주요 이슈를 웹 검색으로 조사하세요."
        )
        web_search = True
    else:
        # 로컬: RSS로 수집한 뉴스를 컨텍스트로 제공
        progress("tool", f"[뉴스 수집(RSS): {sector.name}]")
        try:
            items = fetch_sector_news(sector, cfg)
        except Exception as e:  # 수집 실패해도 진행
            progress("status", f"  (뉴스 수집 실패: {e})")
            items = []
        news_block = (
            "아래는 수집된 최근 뉴스 헤드라인입니다. 이 자료에 근거해 작성하세요.\n\n"
            + format_news(items)
        )
        web_search = False

    prompt = f"""\
오늘 날짜: {today}
대상 섹터: [{sector.region_label}] {sector.name}
참고 키워드: {keywords}

{news_block}

다음 형식의 브리핑을 작성하세요.

## [{sector.region_label}] {sector.name} 섹터 브리핑
### 주요 이슈 (중요도 순 3~6개)
- 이슈별: 무슨 일이 있었는지 / 시장·주가 반응 / 투자 관점에서의 의미 / 출처
### 섹터 분위기 한 줄 요약
"""
    return backend.complete(RESEARCH_SYSTEM, prompt, progress, web_search=web_search)


def synthesize_report(backend, cfg: Config, briefings: list[str], today: str, progress: ProgressFn) -> str:
    """섹터 브리핑들을 종합해 최종 투자 리포트(Markdown)를 반환한다."""
    joined = "\n\n---\n\n".join(briefings)
    prompt = f"""\
오늘 날짜: {today}

아래는 섹터별 리서치 브리핑입니다. 이를 종합해 데일리 섹터 리포트를 작성하세요.
제목은 "# 데일리 섹터 리포트 — {today}" 로 시작하세요.

{joined}
"""
    return backend.complete(SYNTHESIS_SYSTEM, prompt, progress, web_search=False)


def run(cfg: Config, output_path: Path | None = None, progress: ProgressFn = _default_progress) -> Path:
    """전체 파이프라인을 실행하고 리포트 파일 경로를 반환한다."""
    backend = make_backend(cfg)
    label = "Claude API" if cfg.backend == "claude" else f"로컬 Ollama ({cfg.ollama_model})"
    progress("status", f"백엔드: {label}")

    now = datetime.now(ZoneInfo(cfg.timezone))
    today = now.strftime("%Y-%m-%d (%a)")

    briefings: list[str] = []
    for i, sector in enumerate(cfg.sectors, 1):
        progress("status", f"=== [{i}/{len(cfg.sectors)}] {sector.region_label} · {sector.name} 리서치 중 ===")
        briefings.append(research_sector(backend, cfg, sector, today, progress))

    progress("status", "=== 종합 리포트 작성 중 ===")
    report = synthesize_report(backend, cfg, briefings, today, progress)

    if output_path is None:
        cfg.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = cfg.output_dir / f"{now.strftime('%Y-%m-%d')}_sector_report.md"
    output_path.write_text(report + "\n", encoding="utf-8")
    progress("status", f"리포트 저장 완료: {output_path}")
    return output_path
