#!/usr/bin/env bash
# 매일 리포트 생성 래퍼 (launchd가 호출). ollama 서버를 확인·기동한 뒤 에이전트를 실행한다.
set -euo pipefail

# 저장소 루트로 이동 (scripts/의 상위)
cd "$(cd "$(dirname "$0")/.." && pwd)"

# launchd는 최소 PATH로 실행되므로 Homebrew 경로를 보강
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "===== $(date '+%Y-%m-%d %H:%M:%S') 리포트 생성 시작 ====="

# 1) ollama 서버 확인, 없으면 백그라운드 기동
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "ollama 서버 기동 중..."
  (ollama serve >/tmp/ollama-serve.log 2>&1 &) || true
  for i in $(seq 1 30); do
    curl -sf http://localhost:11434/api/tags >/dev/null 2>&1 && break
    sleep 1
  done
fi

# 2) venv가 있으면 사용
if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

# 3) 리포트 생성 (config.yaml의 backend=ollama, 무료)
python3 -m sector_news_agent

echo "===== $(date '+%Y-%m-%d %H:%M:%S') 완료 ====="
