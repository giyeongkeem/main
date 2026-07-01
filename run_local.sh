#!/usr/bin/env bash
# 로컬에서 웹 UI를 실행합니다.
#   ANTHROPIC_API_KEY=sk-ant-... ./run_local.sh
set -euo pipefail

if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${ANTHROPIC_AUTH_TOKEN:-}" ]; then
  echo "오류: ANTHROPIC_API_KEY 환경변수를 먼저 설정하세요." >&2
  echo "  export ANTHROPIC_API_KEY=sk-ant-..." >&2
  exit 1
fi

pip install -q -r requirements.txt
echo "브라우저에서 http://localhost:${PORT:-8000} 를 여세요 (종료: Ctrl+C)"
exec python -m sector_news_agent.web
