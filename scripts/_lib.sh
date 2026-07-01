#!/usr/bin/env bash
# Shared helpers for run.sh / run-public.sh. Source this: `. scripts/_lib.sh`
# All functions assume the working directory is the project root.

# Create .env from the template on first run.
ensure_env_file() {
  if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo "ℹ️  .env 파일을 새로 만들었습니다."
  fi
}

# True if KEY has a non-empty value in .env.
has_key() { grep -Eq "^$1=.+" .env 2>/dev/null; }

# Print the last value of KEY from .env (python-dotenv uses last-wins).
env_value() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-; }

# Ensure DASHBOARD_PASSWORD exists (generate + persist if missing). Echoes the
# password. Required whenever the server is reachable beyond localhost.
ensure_password() {
  if ! has_key DASHBOARD_PASSWORD; then
    local pw
    pw=$(LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c 12)
    echo "DASHBOARD_PASSWORD=${pw}" >> .env
    echo "🔐 접속 비밀번호를 자동 생성해 .env에 저장했습니다." >&2
  fi
  env_value DASHBOARD_PASSWORD
}

# Print registration guidance for any missing API keys.
warn_missing_keys() {
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
}

# Best-effort LAN IP (en0/en1 on macOS, first address on Linux).
lan_ip() {
  ipconfig getifaddr en0 2>/dev/null \
    || ipconfig getifaddr en1 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}'
}

# Tailscale IPv4 if the CLI is present and connected, else empty.
tailscale_ip() {
  local ts
  ts=$(command -v tailscale 2>/dev/null || true)
  [ -z "$ts" ] && [ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ] \
    && ts="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
  [ -n "$ts" ] && "$ts" ip -4 2>/dev/null | head -1
}
