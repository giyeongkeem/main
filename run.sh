#!/usr/bin/env bash
# Start Shorts Studio so other devices on the same Wi-Fi (e.g. iPhone) can connect.
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

# 처음 실행이면 .env를 자동 생성
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "ℹ️  .env 파일을 새로 만들었습니다."
fi

# .env에 키가 비어 있으면 등록 명령어 안내 (python-dotenv는 같은 키가 중복되면 마지막 값을 사용)
has_key() { grep -Eq "^$1=.+" .env 2>/dev/null; }

if ! has_key ANTHROPIC_API_KEY; then
  echo ""
  echo "⚠️  ANTHROPIC_API_KEY가 등록되지 않았습니다 — 샘플 스크립트 모드로 실행됩니다."
  echo "   발급: https://console.anthropic.com → 아래 명령어로 등록 후 재시작:"
  echo ""
  echo "   echo 'ANTHROPIC_API_KEY=sk-ant-여기에-발급받은-키' >> .env"
  echo ""
fi

if ! has_key PEXELS_API_KEY; then
  echo "ℹ️  PEXELS_API_KEY가 없어 배경은 단색으로 만들어집니다. (선택사항)"
  echo "   무료 발급: https://www.pexels.com/api/ → 등록 명령어:"
  echo ""
  echo "   echo 'PEXELS_API_KEY=여기에-발급받은-키' >> .env"
  echo ""
fi

# Find the Mac's LAN IP (en0 = Wi-Fi on most Macs), with Linux fallback.
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')

echo "──────────────────────────────────────────────"
echo "  🎬 Shorts Studio"
echo "  이 컴퓨터:  http://127.0.0.1:${PORT}"
if [ -n "$IP" ]; then
  echo "  아이폰:     http://${IP}:${PORT}"
  echo "              (같은 Wi-Fi에 연결된 기기에서 접속)"
else
  echo "  ⚠️ LAN IP를 찾지 못했습니다. 시스템 설정 > Wi-Fi에서 IP를 확인하세요."
fi

# Tailscale이 설치돼 있으면 셀룰러에서도 쓸 수 있는 주소를 함께 안내
TS_BIN=$(command -v tailscale 2>/dev/null || true)
[ -z "$TS_BIN" ] && [ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ] && TS_BIN="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
if [ -n "$TS_BIN" ]; then
  TS_IP=$("$TS_BIN" ip -4 2>/dev/null | head -1)
  if [ -n "$TS_IP" ]; then
    echo "  셀룰러:     http://${TS_IP}:${PORT}"
    echo "              (아이폰 Tailscale 앱이 켜져 있으면 어디서든 접속)"
  fi
fi
echo "──────────────────────────────────────────────"

exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
