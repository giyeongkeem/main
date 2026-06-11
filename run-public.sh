#!/usr/bin/env bash
# Expose Shorts Studio to the internet (cellular access) via a free Cloudflare
# quick tunnel. Generates a dashboard password automatically if missing.
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "⚠️  cloudflared가 설치되어 있지 않습니다. 아래 명령어로 설치 후 다시 실행하세요:"
  echo ""
  echo "   brew install cloudflared"
  echo ""
  exit 1
fi

[ ! -f .env ] && [ -f .env.example ] && cp .env.example .env

# 외부 공개 시 비밀번호 필수 — 없으면 자동 생성해서 .env에 저장
if ! grep -Eq '^DASHBOARD_PASSWORD=.+' .env 2>/dev/null; then
  PW=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 12)
  echo "DASHBOARD_PASSWORD=${PW}" >> .env
  echo "🔐 접속 비밀번호를 자동 생성해 .env에 저장했습니다."
fi
PASSWORD=$(grep -E '^DASHBOARD_PASSWORD=' .env | tail -1 | cut -d= -f2-)

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

uvicorn app.main:app --host 127.0.0.1 --port "$PORT" &
SERVER_PID=$!
sleep 2

TUNNEL_LOG=$(mktemp)
echo "🌐 공개 터널 생성 중... (Cloudflare)"
cloudflared tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

URL=""
for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "❌ 터널 생성에 실패했습니다. 로그:"
  tail -20 "$TUNNEL_LOG"
  exit 1
fi

echo ""
echo "──────────────────────────────────────────────"
echo "  🎬 Shorts Studio — 외부 접속 모드"
echo ""
echo "  주소:       ${URL}"
echo "  사용자 이름: 아무거나 (예: me)"
echo "  비밀번호:    ${PASSWORD}"
echo ""
echo "  셀룰러/외부 어디서든 위 주소로 접속하세요."
echo "  이 터미널을 닫으면 접속이 끊깁니다. (Ctrl+C로 종료)"
echo "──────────────────────────────────────────────"
echo ""

wait "$TUNNEL_PID"
