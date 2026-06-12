"""섹터별 이슈 수집(웹 검색) → 종합 투자 리포트 생성 파이프라인.

흐름:
1. research_sector() — 섹터마다 Claude + 서버사이드 web_search/web_fetch 도구로
   최근 주요 이슈를 수집·정리한 섹터 브리핑을 만든다.
2. synthesize_report() — 섹터 브리핑들을 모아 투자 관점의 최종 리포트를 작성한다.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import anthropic

from .config import Config, Sector

# 서버사이드 도구가 반복 한도에 걸려 pause_turn으로 멈췄을 때 이어서 실행하는 최대 횟수
MAX_CONTINUATIONS = 6

RESEARCH_SYSTEM = """\
당신은 한국 기관투자자 리서치팀의 섹터 애널리스트입니다.
주어진 주식 섹터의 최근 주요 이슈를 웹 검색으로 수집하고, 투자 판단에 필요한 핵심만 정리합니다.

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


def _stream_until_done(
    client: anthropic.Anthropic,
    *,
    system: str,
    messages: list[dict],
    model: str,
    effort: str,
    tools: list[dict] | None = None,
    verbose: bool = True,
) -> anthropic.types.Message:
    """스트리밍으로 호출하고, 서버사이드 도구의 pause_turn이면 이어서 실행한다."""
    messages = list(messages)
    response = None
    for _ in range(MAX_CONTINUATIONS):
        kwargs: dict = dict(
            model=model,
            max_tokens=64000,
            system=system,
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            messages=messages,
        )
        if tools:
            kwargs["tools"] = tools

        with client.messages.stream(**kwargs) as stream:
            for event in stream:
                if not verbose:
                    continue
                if event.type == "content_block_start" and event.content_block.type == "server_tool_use":
                    print(f"\n  [도구 실행: {event.content_block.name}]", file=sys.stderr)
                elif event.type == "content_block_delta" and event.delta.type == "text_delta":
                    print(event.delta.text, end="", flush=True, file=sys.stderr)
            response = stream.get_final_message()

        if response.stop_reason == "refusal":
            raise RuntimeError("요청이 안전상의 이유로 거부되었습니다 (stop_reason=refusal).")
        if response.stop_reason == "pause_turn":
            # 서버사이드 도구 반복 한도 도달 — assistant 턴을 붙여 재요청하면 이어서 실행됨
            messages.append({"role": "assistant", "content": response.content})
            continue
        return response

    raise RuntimeError(f"pause_turn이 {MAX_CONTINUATIONS}회 연속 발생해 중단했습니다.")


def _text_of(response: anthropic.types.Message) -> str:
    return "\n".join(block.text for block in response.content if block.type == "text").strip()


def research_sector(client: anthropic.Anthropic, cfg: Config, sector: Sector, today: str) -> str:
    """단일 섹터의 최근 이슈를 웹 검색으로 수집해 브리핑 텍스트를 반환한다."""
    keywords = ", ".join(sector.keywords) if sector.keywords else "(없음)"
    prompt = f"""\
오늘 날짜: {today}
대상 섹터: [{sector.region_label}] {sector.name}
참고 키워드: {keywords}

위 섹터의 최근 주요 이슈를 웹 검색으로 조사하고, 다음 형식의 브리핑을 작성하세요.

## [{sector.region_label}] {sector.name} 섹터 브리핑
### 주요 이슈 (중요도 순 3~6개)
- 이슈별: 무슨 일이 있었는지 / 시장·주가 반응 / 투자 관점에서의 의미 / 출처
### 섹터 분위기 한 줄 요약
"""
    tools = [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": cfg.max_web_searches_per_sector},
        {"type": "web_fetch_20260209", "name": "web_fetch"},
    ]
    response = _stream_until_done(
        client,
        system=RESEARCH_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        model=cfg.model,
        effort=cfg.effort,
        tools=tools,
    )
    return _text_of(response)


def synthesize_report(client: anthropic.Anthropic, cfg: Config, briefings: list[str], today: str) -> str:
    """섹터 브리핑들을 종합해 최종 투자 리포트(Markdown)를 반환한다."""
    joined = "\n\n---\n\n".join(briefings)
    prompt = f"""\
오늘 날짜: {today}

아래는 섹터별 리서치 브리핑입니다. 이를 종합해 데일리 섹터 리포트를 작성하세요.
제목은 "# 데일리 섹터 리포트 — {today}" 로 시작하세요.

{joined}
"""
    response = _stream_until_done(
        client,
        system=SYNTHESIS_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        model=cfg.model,
        effort=cfg.effort,
    )
    return _text_of(response)


def run(cfg: Config, output_path: Path | None = None) -> Path:
    """전체 파이프라인을 실행하고 리포트 파일 경로를 반환한다."""
    client = anthropic.Anthropic()
    now = datetime.now(ZoneInfo(cfg.timezone))
    today = now.strftime("%Y-%m-%d (%a)")

    briefings: list[str] = []
    for i, sector in enumerate(cfg.sectors, 1):
        print(f"\n=== [{i}/{len(cfg.sectors)}] {sector.region_label} · {sector.name} 리서치 중 ===", file=sys.stderr)
        briefings.append(research_sector(client, cfg, sector, today))

    print("\n=== 종합 리포트 작성 중 ===", file=sys.stderr)
    report = synthesize_report(client, cfg, briefings, today)

    if output_path is None:
        cfg.output_dir.mkdir(parents=True, exist_ok=True)
        output_path = cfg.output_dir / f"{now.strftime('%Y-%m-%d')}_sector_report.md"
    output_path.write_text(report + "\n", encoding="utf-8")
    print(f"\n\n리포트 저장 완료: {output_path}", file=sys.stderr)
    return output_path
