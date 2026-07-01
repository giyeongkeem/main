#!/usr/bin/env bash
# 맥북 무료 영구화 설치 스크립트.
# - Python 가상환경 + 의존성 설치
# - launchd LaunchAgent 등록 → 매일 오전 7:00 자동 실행
#   (잠자기 상태여도 깨어나면 놓친 작업을 자동 실행)
#
# 사용법:  bash scripts/install_macos.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.sectornews.dailyreport"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "저장소: $REPO"

# 0) 사전 점검
command -v python3 >/dev/null || { echo "python3가 필요합니다."; exit 1; }
if ! command -v ollama >/dev/null; then
  echo "⚠️  ollama가 설치되어 있지 않습니다. https://ollama.com 에서 설치 후 다시 실행하세요."
  exit 1
fi

# 1) 가상환경 + 의존성
echo "→ Python 가상환경 및 의존성 설치..."
python3 -m venv "$REPO/.venv"
"$REPO/.venv/bin/pip" install -q --upgrade pip
"$REPO/.venv/bin/pip" install -q -r "$REPO/requirements.txt"

# 2) 모델 준비 안내 (자동 pull은 용량이 커서 확인 후)
MODEL="$(grep -A2 'ollama:' "$REPO/config.yaml" | grep 'model:' | awk '{print $2}' | head -1)"
MODEL="${MODEL:-qwen2.5:72b}"
if ! ollama list 2>/dev/null | grep -q "${MODEL%%:*}"; then
  echo "→ 모델 '$MODEL' 다운로드 (용량 큼, 시간 소요)..."
  ollama pull "$MODEL"
fi

# 3) LaunchAgent plist 생성 (매일 07:00)
echo "→ launchd 등록 ($PLIST)..."
mkdir -p "$HOME/Library/LaunchAgents" "$REPO/logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO/scripts/run_daily.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>7</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>$REPO/logs/daily.out.log</string>
  <key>StandardErrorPath</key><string>$REPO/logs/daily.err.log</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PLIST

# 4) 로드 (기존 것 있으면 교체)
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
echo "✅ 설치 완료. 매일 오전 7:00에 무료로 리포트가 생성됩니다 (reports/ 폴더)."
echo "   - 지금 즉시 테스트:   bash scripts/run_daily.sh"
echo "   - 로그 확인:          tail -f logs/daily.err.log"
echo "   - 해제:               launchctl unload \"$PLIST\" && rm \"$PLIST\""
