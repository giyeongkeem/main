"""CLI 진입점: python -m sector_news_agent [--config config.yaml] [--output report.md]"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from .agent import run
from .config import load_config


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="sector-news-agent",
        description="국내/해외 관심 섹터의 주요 이슈를 수집해 투자 관점 리포트를 생성합니다.",
    )
    parser.add_argument("--config", default="config.yaml", help="설정 파일 경로 (기본: config.yaml)")
    parser.add_argument("--output", default=None, help="리포트 저장 경로 (기본: reports/YYYY-MM-DD_sector_report.md)")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY") and not os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        print("오류: ANTHROPIC_API_KEY 환경변수를 설정하세요.", file=sys.stderr)
        return 1

    cfg = load_config(args.config)
    run(cfg, Path(args.output) if args.output else None)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
