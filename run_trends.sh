#!/usr/bin/env bash
# 소셜미디어 트렌드 대시보드 실행 (맥/리눅스 공용)
#   bash run_trends.sh          # → http://localhost:8100
# 가상환경 생성과 의존성 설치까지 알아서 처리합니다.
set -euo pipefail
cd "$(dirname "$0")"

command -v python3 >/dev/null || {
  echo "python3가 필요합니다. 맥이라면 터미널에서 다음을 먼저 실행하세요:" >&2
  echo "  xcode-select --install" >&2
  exit 1
}

if [ ! -d .venv ]; then
  echo "→ 최초 1회: Python 가상환경 생성 중..."
  python3 -m venv .venv
fi
echo "→ 의존성 확인 중..."
.venv/bin/pip install -q -r requirements.txt

echo ""
echo "✅ 브라우저에서  http://localhost:${PORT:-8100}  을 여세요 (종료: Ctrl+C)"
echo ""
exec .venv/bin/python -m trend_dashboard
