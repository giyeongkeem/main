"""리포트 아카이빙 — GitHub 커밋·푸시 + Notion 데이터베이스 페이지 생성.

- GitHub: 저장소의 reports/ 변경분을 커밋하고 현재 브랜치에 푸시한다.
- Notion: 공식 API(무료)로 데이터베이스에 페이지를 만든다.
  NOTION_API_KEY 환경변수(통합 시크릿)가 필요하며, 대상 데이터베이스가
  해당 통합에 '연결'되어 있어야 한다. README의 아카이빙 절 참고.

둘 다 실패해도 리포트 생성 자체는 성공으로 처리한다(아카이빙은 부가 기능).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable

from .config import Config

ProgressFn = Callable[[str, str], None]

NOTION_API = "https://api.notion.com/v1/pages"
NOTION_QUERY_API = "https://api.notion.com/v1/databases/{db}/query"
NOTION_VERSION = "2022-06-28"


# ---------- GitHub ----------

def git_archive(repo_dir: Path, date_str: str, progress: ProgressFn) -> bool:
    """reports/ 변경분을 커밋하고 push한다. 성공 시 True."""

    def _git(*args: str) -> subprocess.CompletedProcess:
        return subprocess.run(["git", *args], cwd=repo_dir, capture_output=True, text=True)

    if _git("rev-parse", "--is-inside-work-tree").returncode != 0:
        progress("status", "  (git 저장소가 아님 — GitHub 아카이빙 생략)")
        return False

    _git("add", "reports/")
    if _git("diff", "--cached", "--quiet").returncode == 0:
        progress("status", "  (reports/ 변경 없음 — 커밋 생략)")
        return False

    commit = _git("commit", "-m", f"report: {date_str} 데일리 섹터 리포트")
    if commit.returncode != 0:
        progress("status", f"  (커밋 실패: {commit.stderr.strip()[:120]})")
        return False

    # 네트워크 오류 대비 지수 백오프 재시도
    for attempt, delay in enumerate((0, 2, 4, 8, 16), 1):
        if delay:
            time.sleep(delay)
        push = _git("push")
        if push.returncode == 0:
            progress("status", "  GitHub 푸시 완료")
            return True
        progress("status", f"  (푸시 재시도 {attempt}/5: {push.stderr.strip()[:80]})")
    progress("status", "  (GitHub 푸시 실패 — 커밋은 로컬에 남아 있음)")
    return False


# ---------- Notion ----------

_BOLD = re.compile(r"\*\*(.+?)\*\*")
_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def _plain(text: str) -> str:
    """마크다운 강조·링크 문법을 평문으로 정리 (Notion rich_text는 평문으로 넣음)."""
    text = _BOLD.sub(r"\1", text)
    text = _LINK.sub(r"\1", text)
    return text[:1900]  # rich_text 2000자 제한 여유


def _rt(text: str) -> list[dict]:
    return [{"type": "text", "text": {"content": _plain(text)}}]


def _md_to_blocks(md: str, limit: int = 90) -> list[dict]:
    """마크다운을 Notion 블록으로 단순 변환 (표는 생략 — 원문은 GitHub 링크 참조)."""
    blocks: list[dict] = []
    for line in md.splitlines():
        s = line.strip()
        if not s or s.startswith("|") or set(s) <= {"-", " "}:
            continue
        if s.startswith("### "):
            blocks.append({"type": "heading_3", "heading_3": {"rich_text": _rt(s[4:])}})
        elif s.startswith("## "):
            blocks.append({"type": "heading_2", "heading_2": {"rich_text": _rt(s[3:])}})
        elif s.startswith("# "):
            blocks.append({"type": "heading_1", "heading_1": {"rich_text": _rt(s[2:])}})
        elif s.startswith(("- ", "* ")):
            blocks.append({"type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rt(s[2:])}})
        elif s.startswith("> "):
            blocks.append({"type": "quote", "quote": {"rich_text": _rt(s[2:])}})
        else:
            blocks.append({"type": "paragraph", "paragraph": {"rich_text": _rt(s)}})
        if len(blocks) >= limit:
            break
    return blocks


def _summary_of(md: str, max_len: int = 300) -> str:
    """'핵심 요약' 섹션의 첫 불릿 몇 개를 요약 텍스트로 추출."""
    bullets = []
    in_summary = False
    for line in md.splitlines():
        s = line.strip()
        if s.startswith("##") and "요약" in s:
            in_summary = True
            continue
        if in_summary:
            if s.startswith("##"):
                break
            if s.startswith(("- ", "* ")):
                bullets.append(_plain(s[2:]))
    return " / ".join(bullets)[:max_len] if bullets else _plain(md)[:max_len]


def _notion_page_exists(token: str, database_id: str, date_str: str) -> bool:
    """같은 날짜의 페이지가 이미 있는지 조회 (재실행 시 중복 생성 방지).

    조회 자체가 실패하면 False를 반환해 생성을 막지 않는다.
    """
    payload = {
        "filter": {"property": "날짜", "date": {"equals": date_str}},
        "page_size": 1,
    }
    req = urllib.request.Request(
        NOTION_QUERY_API.format(db=database_id),
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        return bool(data.get("results"))
    except Exception:
        return False


def notion_archive(
    md_text: str,
    date_str: str,
    cfg: Config,
    github_url: str,
    progress: ProgressFn,
) -> bool:
    """Notion 데이터베이스에 리포트 페이지를 생성한다. 성공 시 True."""
    token = os.environ.get("NOTION_API_KEY", "").strip()
    if not token:
        progress("status", "  (NOTION_API_KEY 미설정 — Notion 아카이빙 생략)")
        return False
    if not cfg.notion_database_id:
        progress("status", "  (archive.notion.database_id 미설정 — Notion 아카이빙 생략)")
        return False
    if _notion_page_exists(token, cfg.notion_database_id, date_str):
        progress("status", f"  (같은 날짜({date_str}) 페이지가 이미 있어 중복 생성 생략)")
        return True

    sector_names = [s.name for s in cfg.sectors]
    payload = {
        "parent": {"database_id": cfg.notion_database_id},
        "icon": {"type": "emoji", "emoji": "📈"},
        "properties": {
            "제목": {"title": _rt(f"{date_str} 데일리 섹터 리포트")},
            "날짜": {"date": {"start": date_str}},
            "섹터": {"multi_select": [{"name": n} for n in sector_names]},
            "핵심 요약": {"rich_text": _rt(_summary_of(md_text))},
            "GitHub": {"url": github_url},
        },
        "children": _md_to_blocks(md_text),
    }

    req = urllib.request.Request(
        NOTION_API,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            page = json.loads(resp.read())
        progress("status", f"  Notion 저장 완료: {page.get('url', '')}")
        return True
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:200]
        progress("status", f"  (Notion 저장 실패 {e.code}: {detail})")
        return False
    except urllib.error.URLError as e:
        progress("status", f"  (Notion 접속 실패: {e})")
        return False
