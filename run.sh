#!/usr/bin/env bash
# Start Shorts Studio so other devices on the same Wi-Fi (e.g. iPhone) can connect.
set -e
cd "$(dirname "$0")"
. scripts/_lib.sh

PORT="${PORT:-8000}"

ensure_env_file
warn_missing_keys

# run.sh binds 0.0.0.0 so the LAN (iPhone) can reach it — which means the wider
# network can too. Require a password so an empty DASHBOARD_PASSWORD can't leave
# the dashboard (and the paid Claude/Pexels calls behind it) open to anyone on
# the network. For a private localhost-only run, use: uvicorn app.main:app --port 8000
PASSWORD=$(ensure_password)

IP=$(lan_ip)
TS_IP=$(tailscale_ip)

echo "──────────────────────────────────────────────"
echo "  🎬 Shorts Studio"
echo "  이 컴퓨터:  http://127.0.0.1:${PORT}"
if [ -n "$IP" ]; then
  echo "  아이폰:     http://${IP}:${PORT}"
  echo "              (같은 Wi-Fi에 연결된 기기에서 접속)"
else
  echo "  ⚠️ LAN IP를 찾지 못했습니다. 시스템 설정 > Wi-Fi에서 IP를 확인하세요."
fi
if [ -n "$TS_IP" ]; then
  echo "  셀룰러:     http://${TS_IP}:${PORT}"
  echo "              (아이폰 Tailscale 앱이 켜져 있으면 어디서든 접속)"
fi
echo ""
echo "  사용자 이름: 아무거나 (예: me)"
echo "  비밀번호:    ${PASSWORD}"
echo "──────────────────────────────────────────────"

exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
