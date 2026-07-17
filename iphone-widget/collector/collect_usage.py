#!/usr/bin/env python3
"""Claude Code + ChatGPT Codex 사용량 수집기.

Mac(또는 CLI를 쓰는 머신)에서 주기적으로 실행하면
  1. Claude Code 로컬 로그(~/.claude/projects/**/*.jsonl)에서 토큰/비용 집계
  2. Claude OAuth 사용량 API(가능한 경우)에서 5시간/주간 리밋 사용률(%) 조회
  3. Codex 세션 로그(~/.codex/sessions/**/*.jsonl)에서 토큰 집계 + 리밋 사용률(%) 파싱
을 수행해 usage.json을 만들고, GitHub Gist에 업로드합니다.
iPhone의 Scriptable 위젯(UsageWidget.js)이 이 JSON을 읽어 표시합니다.

의존성 없음(파이썬 표준 라이브러리만 사용).

사용 예:
  # 최초 1회: gist 생성 (출력된 gist id를 이후에 사용)
  GITHUB_TOKEN=ghp_xxx python3 collect_usage.py --create-gist

  # 이후: 기존 gist 갱신 (launchd/cron으로 10분마다 실행 권장)
  GITHUB_TOKEN=ghp_xxx python3 collect_usage.py --gist-id <GIST_ID>

  # 업로드 없이 로컬 파일로만 확인
  python3 collect_usage.py --no-upload --output usage.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# 가격표 (USD / 1M tokens) — 대략적인 비용 추정용
# ---------------------------------------------------------------------------

CLAUDE_PRICING = [
    # (모델명 부분 문자열, input, output, cache_write, cache_read)
    ("opus", 15.0, 75.0, 18.75, 1.50),
    ("sonnet", 3.0, 15.0, 3.75, 0.30),
    ("haiku", 0.80, 4.0, 1.0, 0.08),
    ("fable", 15.0, 75.0, 18.75, 1.50),
]

CODEX_PRICING = [
    # (모델명 부분 문자열, input, output, cached_input)
    ("gpt-5", 1.25, 10.0, 0.125),
    ("codex", 1.25, 10.0, 0.125),
    ("o3", 2.0, 8.0, 0.5),
    ("o4-mini", 1.1, 4.4, 0.275),
]


def _claude_price(model: str):
    m = (model or "").lower()
    for key, i, o, cw, cr in CLAUDE_PRICING:
        if key in m:
            return i, o, cw, cr
    return CLAUDE_PRICING[1][1:]  # 기본값: sonnet


def _codex_price(model: str):
    m = (model or "").lower()
    for key, i, o, ci in CODEX_PRICING:
        if key in m:
            return i, o, ci
    return CODEX_PRICING[0][1:]  # 기본값: gpt-5


# ---------------------------------------------------------------------------
# 공통 유틸
# ---------------------------------------------------------------------------

def _parse_ts(value) -> datetime | None:
    """ISO 타임스탬프 문자열/epoch 숫자를 aware datetime(UTC)으로."""
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        s = str(value).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (ValueError, OSError):
        return None


class Buckets:
    """last_5h / today / week 구간별 토큰·비용 누적기."""

    def __init__(self, now_utc: datetime):
        self.now = now_utc
        local_now = now_utc.astimezone()
        self.today_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        self.h5_start = now_utc - timedelta(hours=5)
        self.week_start = now_utc - timedelta(days=7)
        self.data = {
            "last_5h": {"tokens": 0, "cost_usd": 0.0},
            "today": {"tokens": 0, "cost_usd": 0.0},
            "week": {"tokens": 0, "cost_usd": 0.0},
        }

    def add(self, ts: datetime, tokens: int, cost: float):
        if ts >= self.week_start:
            self._acc("week", tokens, cost)
        if ts >= self.today_start:
            self._acc("today", tokens, cost)
        if ts >= self.h5_start:
            self._acc("last_5h", tokens, cost)

    def _acc(self, key: str, tokens: int, cost: float):
        self.data[key]["tokens"] += tokens
        self.data[key]["cost_usd"] += cost

    def result(self) -> dict:
        for v in self.data.values():
            v["cost_usd"] = round(v["cost_usd"], 4)
        return self.data


# ---------------------------------------------------------------------------
# Claude Code — 로컬 JSONL 집계
# ---------------------------------------------------------------------------

def collect_claude(now_utc: datetime) -> dict:
    roots = [
        Path.home() / ".claude" / "projects",
        Path.home() / ".config" / "claude" / "projects",
    ]
    buckets = Buckets(now_utc)
    seen: set[str] = set()
    cutoff = now_utc - timedelta(days=8)

    for root in roots:
        if not root.is_dir():
            continue
        for path in root.rglob("*.jsonl"):
            try:
                # 8일 넘게 수정 안 된 파일은 건너뛰어 속도 확보
                if datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc) < cutoff:
                    continue
                with path.open("r", encoding="utf-8", errors="replace") as fh:
                    for line in fh:
                        _claude_line(line, buckets, seen, cutoff)
            except OSError:
                continue

    return {"totals": buckets.result()}


def _claude_line(line: str, buckets: Buckets, seen: set, cutoff: datetime):
    line = line.strip()
    if not line or '"usage"' not in line:
        return
    try:
        entry = json.loads(line)
    except json.JSONDecodeError:
        return
    msg = entry.get("message") or {}
    usage = msg.get("usage")
    if not isinstance(usage, dict):
        return
    ts = _parse_ts(entry.get("timestamp"))
    if ts is None or ts < cutoff:
        return
    # 동일 메시지가 여러 JSONL에 중복 기록되는 경우 제거
    dedupe = f"{msg.get('id', '')}:{entry.get('requestId', '')}"
    if dedupe != ":" and dedupe in seen:
        return
    seen.add(dedupe)

    inp = usage.get("input_tokens") or 0
    out = usage.get("output_tokens") or 0
    cw = usage.get("cache_creation_input_tokens") or 0
    cr = usage.get("cache_read_input_tokens") or 0
    pi, po, pcw, pcr = _claude_price(msg.get("model", ""))
    cost = (inp * pi + out * po + cw * pcw + cr * pcr) / 1_000_000
    buckets.add(ts, inp + out + cw + cr, cost)


def fetch_claude_rate_limits() -> dict:
    """Claude Code OAuth 토큰으로 공식 사용률(%) 조회 (베스트에포트).

    실패해도 예외 없이 빈 dict를 돌려주고, 위젯은 로컬 집계만 표시합니다.
    """
    cred_path = Path.home() / ".claude" / ".credentials.json"
    try:
        creds = json.loads(cred_path.read_text())
        token = (creds.get("claudeAiOauth") or {}).get("accessToken")
    except (OSError, json.JSONDecodeError):
        return {}
    if not token:
        return {}

    req = urllib.request.Request(
        "https://api.anthropic.com/api/oauth/usage",
        headers={
            "Authorization": f"Bearer {token}",
            "anthropic-beta": "oauth-2025-04-20",
            "Content-Type": "application/json",
            "User-Agent": "usage-widget-collector",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return {}

    return _extract_percents(payload)


def _extract_percents(payload) -> dict:
    """응답 스키마 변화에 대비해 5시간/주간 사용률(%)을 방어적으로 추출."""
    out: dict = {}

    def pct_of(node) -> float | None:
        if not isinstance(node, dict):
            return None
        for k in ("utilization", "used_percent", "percent_used", "usage_percent"):
            v = node.get(k)
            if isinstance(v, (int, float)):
                return float(v) * 100 if 0 <= v <= 1 and k == "utilization" and v <= 1 else float(v)
        used, limit = node.get("used"), node.get("limit")
        if isinstance(used, (int, float)) and isinstance(limit, (int, float)) and limit:
            return used / limit * 100
        return None

    def reset_of(node):
        if isinstance(node, dict):
            for k in ("resets_at", "reset_at", "resets_in_seconds"):
                if k in node:
                    return node[k]
        return None

    def walk(obj):
        if not isinstance(obj, dict):
            return
        for key, val in obj.items():
            lk = key.lower()
            if any(t in lk for t in ("five_hour", "5h", "session")) and "five_hour_pct" not in out:
                p = pct_of(val)
                if p is not None:
                    out["five_hour_pct"] = round(p, 1)
                    out["five_hour_resets"] = reset_of(val)
            elif any(t in lk for t in ("seven_day", "7d", "week")) and "opus" not in lk and "weekly_pct" not in out:
                p = pct_of(val)
                if p is not None:
                    out["weekly_pct"] = round(p, 1)
                    out["weekly_resets"] = reset_of(val)
            if isinstance(val, dict):
                walk(val)

    walk(payload if isinstance(payload, dict) else {})
    return out


# ---------------------------------------------------------------------------
# Codex — 세션 로그 집계 + rate limit 파싱
# ---------------------------------------------------------------------------

def collect_codex(now_utc: datetime) -> dict:
    root = Path.home() / ".codex" / "sessions"
    buckets = Buckets(now_utc)
    cutoff = now_utc - timedelta(days=8)
    latest_limits: tuple[datetime, dict] | None = None

    if root.is_dir():
        for path in root.rglob("*.jsonl"):
            try:
                if datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc) < cutoff:
                    continue
                with path.open("r", encoding="utf-8", errors="replace") as fh:
                    for line in fh:
                        latest_limits = _codex_line(line, buckets, cutoff, latest_limits)
            except OSError:
                continue

    result: dict = {"totals": buckets.result()}
    if latest_limits:
        _, limits = latest_limits
        primary = limits.get("primary") or {}
        secondary = limits.get("secondary") or {}
        if isinstance(primary.get("used_percent"), (int, float)):
            result["five_hour_pct"] = round(float(primary["used_percent"]), 1)
            result["five_hour_resets"] = primary.get("resets_in_seconds")
        if isinstance(secondary.get("used_percent"), (int, float)):
            result["weekly_pct"] = round(float(secondary["used_percent"]), 1)
            result["weekly_resets"] = secondary.get("resets_in_seconds")
    return result


def _codex_line(line: str, buckets: Buckets, cutoff: datetime, latest):
    line = line.strip()
    if not line or "token_count" not in line:
        return latest
    try:
        entry = json.loads(line)
    except json.JSONDecodeError:
        return latest
    payload = entry.get("payload") or {}
    if payload.get("type") != "token_count":
        return latest
    ts = _parse_ts(entry.get("timestamp")) or datetime.now(timezone.utc)

    info = payload.get("info") or {}
    last = info.get("last_token_usage") or {}
    if isinstance(last, dict) and ts >= cutoff:
        inp = last.get("input_tokens") or 0
        out = last.get("output_tokens") or 0
        cached = last.get("cached_input_tokens") or 0
        pi, po, pci = _codex_price(str(info.get("model", "")))
        cost = (max(inp - cached, 0) * pi + out * po + cached * pci) / 1_000_000
        buckets.add(ts, inp + out, cost)

    limits = payload.get("rate_limits")
    if isinstance(limits, dict) and (latest is None or ts >= latest[0]):
        return (ts, limits)
    return latest


# ---------------------------------------------------------------------------
# Gist 업로드
# ---------------------------------------------------------------------------

GIST_FILENAME = "usage.json"


def _github_request(url: str, token: str, method: str, body: dict | None = None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "usage-widget-collector",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def upload_gist(token: str, gist_id: str | None, content: str) -> dict:
    body = {"files": {GIST_FILENAME: {"content": content}}}
    if gist_id:
        return _github_request(f"https://api.github.com/gists/{gist_id}", token, "PATCH", body)
    body.update({"description": "Claude Code / Codex usage (iPhone widget)", "public": False})
    return _github_request("https://api.github.com/gists", token, "POST", body)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Claude Code + Codex 사용량 수집기")
    ap.add_argument("--output", default=None, help="로컬에 저장할 JSON 경로 (선택)")
    ap.add_argument("--gist-id", default=os.environ.get("USAGE_GIST_ID"), help="갱신할 기존 gist id")
    ap.add_argument("--create-gist", action="store_true", help="비공개 gist를 새로 생성")
    ap.add_argument("--no-upload", action="store_true", help="업로드 없이 로컬 저장만")
    args = ap.parse_args()

    now = datetime.now(timezone.utc)
    claude = collect_claude(now)
    claude.update(fetch_claude_rate_limits())
    codex = collect_codex(now)

    doc = {
        "updated_at": now.isoformat(timespec="seconds"),
        "claude": claude,
        "codex": codex,
    }
    content = json.dumps(doc, ensure_ascii=False, indent=2)

    if args.output:
        Path(args.output).write_text(content, encoding="utf-8")
        print(f"저장됨: {args.output}")

    if args.no_upload:
        if not args.output:
            print(content)
        return 0

    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        print("오류: GITHUB_TOKEN 환경변수가 필요합니다 (gist 권한).", file=sys.stderr)
        return 1

    try:
        res = upload_gist(token, None if args.create_gist else args.gist_id, content)
    except urllib.error.HTTPError as e:
        print(f"gist 업로드 실패: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:300]}", file=sys.stderr)
        return 1

    if args.create_gist or not args.gist_id:
        raw_url = res["files"][GIST_FILENAME]["raw_url"]
        # /raw/<sha>/ 형태에서 sha를 제거하면 항상 최신 버전을 가리킴
        parts = raw_url.split("/raw/")
        stable_url = f"{parts[0]}/raw/{GIST_FILENAME}"
        print("gist 생성 완료!")
        print(f"  gist id : {res['id']}")
        print(f"  위젯 URL: {stable_url}")
        print(f"이후 실행: GITHUB_TOKEN=... python3 collect_usage.py --gist-id {res['id']}")
    else:
        print(f"gist 갱신 완료 ({args.gist_id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
