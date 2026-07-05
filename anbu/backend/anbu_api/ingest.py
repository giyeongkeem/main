"""샘플 인제스트 코어 — HTTP 계층과 분리된 롤업 로직.

기기(iOS/watchOS)와 벤더 어댑터(핏빗/삼성헬스)가 모두 이 표준 샘플 포맷으로
수렴한다. 집계값(steps_day 등)과 원시값(steps_raw 등)을 함께 받는다:

  집계값 — steps_day, wake_time, night_hr        : 그대로 기록
  원시값 — steps_raw                              : 일 단위 합산
           heart_rate (00~06시 구간만)            : 야간 평균으로 증분 롤업
           sleep_stage (end_ts가 03~12시인 세그먼트): 종료 시각 최댓값 → 기상 시각
           motion                                  : 마지막 움직임 갱신
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from . import db as store

NIGHT_WINDOW = range(0, 6)    # 야간 심박 집계 구간 (시)
WAKE_WINDOW = range(3, 12)    # 기상 시각으로 인정할 수면 종료 구간 (시)

TYPES = ("steps_day", "wake_time", "night_hr", "steps_raw", "heart_rate", "sleep_stage", "motion")


@dataclass(frozen=True)
class RawSample:
    type: str
    ts: datetime
    value: Optional[float] = None
    end_ts: Optional[datetime] = None


def apply_samples(conn, sid: str, samples: list[RawSample], now: datetime) -> int:
    """샘플 배치를 반영하고 수용 건수를 돌려준다."""
    latest_motion = None
    accepted = 0
    for s in samples:
        if s.type not in TYPES:
            continue
        accepted += 1
        if s.type == "motion":
            latest_motion = max(latest_motion, s.ts) if latest_motion else s.ts
        elif s.type == "steps_day":
            store.upsert_day(conn, sid, s.ts.date(), steps=int(s.value or 0))
        elif s.type == "wake_time":
            store.upsert_day(conn, sid, s.ts.date(), wake_time=int(s.value or 0))
        elif s.type == "night_hr":
            store.upsert_day(conn, sid, s.ts.date(), night_hr=float(s.value or 0))
        elif s.type == "steps_raw":
            store.add_steps(conn, sid, s.ts.date(), int(s.value or 0))
            latest_motion = max(latest_motion, s.ts) if latest_motion else s.ts  # 걸음 = 움직임
        elif s.type == "heart_rate":
            if s.ts.hour in NIGHT_WINDOW:
                store.add_night_hr_sample(conn, sid, s.ts.date(), float(s.value or 0))
        elif s.type == "sleep_stage":
            end = s.end_ts or s.ts
            if end.hour in WAKE_WINDOW:
                store.raise_wake_time(conn, sid, end.date(), end.hour * 60 + end.minute)
    store.touch_device(conn, sid, ingest_at=now, motion_at=latest_motion)
    return accepted
