"""개인 베이스라인 기반 이상 감지 엔진.

원칙:
- 진단이 아니라 "확인 권장" 신호를 만든다 (웰니스 범위, 의료기기 규제 밖).
- 절대값 임계치가 아니라 그 사람의 최근 14일 베이스라인 대비 편차로 판단한다.
- 순수 함수로 구현해 DB 없이 단위 테스트 가능하게 유지한다.

입력 데이터 모델 (기기 → 서버 인제스트 후 일 단위로 집계된 값):
- steps      : 일일 총 걸음 수
- wake_time  : 첫 활동 감지 시각 (자정 기준 분)
- night_hr   : 수면 중 평균 심박 (bpm)
- last_motion: 마지막 움직임 샘플 시각 (datetime) — 일 집계와 별도로 유지
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from statistics import median
from typing import Optional

# 규칙 파라미터 — 지자체/가족 설정으로 오버라이드 가능한 기본값
NO_DATA_HOURS = 48          # 무수신 → 점검 (미착용·미충전 추정)
NO_MOTION_HOURS = 12        # 무움직임 → 긴급
STEPS_DROP_RATIO = 0.4      # 최근 걸음이 베이스라인의 40% 미만 → 주의
STEPS_DROP_DAYS = 3         # 연속 며칠 급감해야 신호로 볼지
LATE_WAKE_MINUTES = 120     # 평소 기상보다 2시간 지연 → 주의
NIGHT_HR_DELTA = 15         # 야간 심박 베이스라인 +15bpm → 주의
NIGHT_HR_NIGHTS = 3         # 연속 3일 밤 상승해야 신호로 볼지
BASELINE_DAYS = 14          # 베이스라인 산출 구간
BASELINE_MIN_DAYS = 5       # 이 미만이면 베이스라인 미성립 → 규칙 스킵

SEVERITY_ORDER = {"긴급": 0, "주의": 1, "점검": 2}


@dataclass(frozen=True)
class DayRecord:
    day: date
    steps: Optional[int] = None
    wake_time: Optional[int] = None   # minutes from midnight
    night_hr: Optional[float] = None


@dataclass(frozen=True)
class Signal:
    kind: str        # no_data | no_motion | steps_drop | late_wake | night_hr
    severity: str    # 긴급 | 주의 | 점검
    message: str
    evidence: dict = field(default_factory=dict)


def _baseline(values: list[float]) -> Optional[float]:
    """직전 14일 구간의 중앙값. 표본이 부족하면 None (규칙 스킵)."""
    vals = [v for v in values if v is not None]
    if len(vals) < BASELINE_MIN_DAYS:
        return None
    return median(vals)


def evaluate(
    days: list[DayRecord],
    last_motion: Optional[datetime],
    last_ingest: Optional[datetime],
    now: datetime,
) -> list[Signal]:
    """한 어르신의 최근 데이터에서 신호 목록을 만든다. 위험도순 정렬."""
    signals: list[Signal] = []
    days = sorted(days, key=lambda d: d.day)
    history = [d for d in days if d.day < now.date()][-BASELINE_DAYS:]

    # 1) 무수신 — 기기 문제일 가능성이 높아 사람 문제와 구분해 '점검'으로 분류
    if last_ingest is None or (now - last_ingest) >= timedelta(hours=NO_DATA_HOURS):
        hours = None if last_ingest is None else int((now - last_ingest).total_seconds() // 3600)
        signals.append(Signal(
            kind="no_data", severity="점검",
            message=f"{hours or NO_DATA_HOURS}시간 무수신 · 미착용/미충전 추정",
            evidence={"hours_since_ingest": hours},
        ))
        # 데이터가 아예 안 들어오면 아래 규칙들은 오탐이므로 여기서 종료
        return signals

    # 2) 무움직임 — 데이터는 수신되는데 움직임이 없음 → 가장 위험한 신호
    if last_motion is not None:
        gap_h = (now - last_motion).total_seconds() / 3600
        if gap_h >= NO_MOTION_HOURS:
            signals.append(Signal(
                kind="no_motion", severity="긴급",
                message=f"{int(gap_h)}시간 무움직임 · 워치 착용 중",
                evidence={"hours_since_motion": round(gap_h, 1)},
            ))

    # 3) 걸음 급감 — 최근 N일이 모두 베이스라인의 40% 미만
    base_steps = _baseline([d.steps for d in history[:-STEPS_DROP_DAYS] or history])
    recent = [d.steps for d in history[-STEPS_DROP_DAYS:] if d.steps is not None]
    if base_steps and len(recent) == STEPS_DROP_DAYS:
        if all(v < base_steps * STEPS_DROP_RATIO for v in recent):
            signals.append(Signal(
                kind="steps_drop", severity="주의",
                message=f"걸음 {STEPS_DROP_DAYS}일 연속 급감 · 평균 {int(base_steps):,} → {int(sum(recent)/len(recent)):,}보",
                evidence={"baseline": int(base_steps), "recent": recent},
            ))

    # 4) 기상 지연 — 오늘 첫 활동이 평소 기상 시각 + 2시간을 넘도록 없음
    base_wake = _baseline([d.wake_time for d in history])
    today = next((d for d in days if d.day == now.date()), None)
    if base_wake is not None:
        now_min = now.hour * 60 + now.minute
        if today is not None and today.wake_time is not None:
            delay = today.wake_time - base_wake
            if delay >= LATE_WAKE_MINUTES:
                signals.append(Signal(
                    kind="late_wake", severity="주의",
                    message=f"기상 {int(delay // 60)}시간 {int(delay % 60)}분 지연",
                    evidence={"baseline_wake": int(base_wake), "today_wake": today.wake_time},
                ))
        elif now_min - base_wake >= LATE_WAKE_MINUTES:
            signals.append(Signal(
                kind="late_wake", severity="주의",
                message=f"평소 {int(base_wake // 60):02d}:{int(base_wake % 60):02d} 기상 → 오늘 미감지",
                evidence={"baseline_wake": int(base_wake), "today_wake": None},
            ))

    # 5) 야간 심박 상승 — 연속 3일 밤 베이스라인 +15bpm 이상
    base_hr = _baseline([d.night_hr for d in history[:-NIGHT_HR_NIGHTS] or history])
    recent_hr = [d.night_hr for d in history[-NIGHT_HR_NIGHTS:] if d.night_hr is not None]
    if base_hr and len(recent_hr) == NIGHT_HR_NIGHTS:
        if all(v >= base_hr + NIGHT_HR_DELTA for v in recent_hr):
            delta = max(recent_hr) - base_hr
            signals.append(Signal(
                kind="night_hr", severity="주의",
                message=f"야간 심박 +{int(delta)}bpm · {NIGHT_HR_NIGHTS}일 연속 수면 중 상승",
                evidence={"baseline": round(base_hr, 1), "recent": recent_hr},
            ))

    signals.sort(key=lambda s: SEVERITY_ORDER[s.severity])
    return signals
