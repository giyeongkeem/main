#!/usr/bin/env bash
# Start Shorts Studio so other devices on the same Wi-Fi (e.g. iPhone) can connect.
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

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
echo "──────────────────────────────────────────────"

exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
