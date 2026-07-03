"""config.yaml 로딩 및 검증.

일부 설정은 환경변수로 오버라이드할 수 있다 (CI/로컬 설정 충돌 방지):
- SECTOR_AGENT_BACKEND: backend.type 오버라이드 ("claude" | "ollama")
- SECTOR_AGENT_ARCHIVE_GIT: archive.git 오버라이드 ("true" | "false")
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class Sector:
    name: str
    keywords: list[str] = field(default_factory=list)
    region: str = "domestic"  # "domestic" | "overseas"

    @property
    def region_label(self) -> str:
        return "국내" if self.region == "domestic" else "해외"


@dataclass
class Config:
    sectors: list[Sector]
    # backend: "claude"(API, 웹검색 내장) | "ollama"(로컬 LLM + 무료 RSS)
    backend: str = "claude"
    model: str = "claude-opus-4-8"
    effort: str = "high"
    max_web_searches_per_sector: int = 8
    # ollama 백엔드 설정
    ollama_model: str = "qwen2.5:72b"
    ollama_host: str = "http://localhost:11434"
    # 로컬 백엔드용 무료 뉴스 수집(Google News RSS)
    news_max_items: int = 8
    news_days: int = 7
    output_dir: Path = Path("reports")
    timezone: str = "Asia/Seoul"
    # 아카이빙
    archive_git: bool = False
    notion_database_id: str = ""
    github_repo_url: str = ""  # Notion 페이지의 GitHub 링크 생성용


def load_config(path: str | Path = "config.yaml") -> Config:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))

    sectors: list[Sector] = []
    for region in ("domestic", "overseas"):
        for entry in (raw.get("sectors") or {}).get(region, []) or []:
            sectors.append(
                Sector(
                    name=str(entry["name"]),
                    keywords=[str(k) for k in entry.get("keywords", [])],
                    region=region,
                )
            )
    if not sectors:
        raise ValueError("config.yaml에 sectors가 비어 있습니다. 최소 1개 섹터를 정의하세요.")

    model_cfg = raw.get("model") or {}
    report_cfg = raw.get("report") or {}
    backend_cfg = raw.get("backend") or {}
    ollama_cfg = backend_cfg.get("ollama") or {}
    news_cfg = raw.get("news") or {}

    # 환경변수가 config.yaml보다 우선한다. config.yaml은 로컬(맥북 ollama) 기준으로
    # 커밋되어 있고, GitHub Actions 등 CI는 환경변수로 claude 백엔드를 강제한다.
    backend = str(
        os.environ.get("SECTOR_AGENT_BACKEND") or backend_cfg.get("type", "claude")
    ).strip().lower()
    if backend not in ("claude", "ollama"):
        raise ValueError(f"backend.type은 'claude' 또는 'ollama'여야 합니다 (현재: {backend}).")

    archive_cfg = raw.get("archive") or {}
    notion_cfg = archive_cfg.get("notion") or {}

    archive_git_env = os.environ.get("SECTOR_AGENT_ARCHIVE_GIT", "").strip().lower()
    if archive_git_env in ("true", "1", "yes"):
        archive_git = True
    elif archive_git_env in ("false", "0", "no"):
        archive_git = False
    else:
        archive_git = bool(archive_cfg.get("git", False))

    return Config(
        sectors=sectors,
        backend=backend,
        model=str(model_cfg.get("name", "claude-opus-4-8")),
        effort=str(model_cfg.get("effort", "high")),
        max_web_searches_per_sector=int(model_cfg.get("max_web_searches_per_sector", 8)),
        ollama_model=str(ollama_cfg.get("model", "qwen2.5:14b")),
        ollama_host=str(ollama_cfg.get("host", "http://localhost:11434")).rstrip("/"),
        news_max_items=int(news_cfg.get("max_items_per_sector", 8)),
        news_days=int(news_cfg.get("days", 7)),
        output_dir=Path(report_cfg.get("output_dir", "reports")),
        timezone=str(report_cfg.get("timezone", "Asia/Seoul")),
        archive_git=archive_git,
        notion_database_id=str(notion_cfg.get("database_id", "") or ""),
        github_repo_url=str(archive_cfg.get("github_repo_url", "") or "").rstrip("/"),
    )
