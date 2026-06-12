"""config.yaml 로딩 및 검증."""

from __future__ import annotations

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
    model: str = "claude-opus-4-8"
    effort: str = "high"
    max_web_searches_per_sector: int = 8
    output_dir: Path = Path("reports")
    timezone: str = "Asia/Seoul"


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
    return Config(
        sectors=sectors,
        model=str(model_cfg.get("name", "claude-opus-4-8")),
        effort=str(model_cfg.get("effort", "high")),
        max_web_searches_per_sector=int(model_cfg.get("max_web_searches_per_sector", 8)),
        output_dir=Path(report_cfg.get("output_dir", "reports")),
        timezone=str(report_cfg.get("timezone", "Asia/Seoul")),
    )
