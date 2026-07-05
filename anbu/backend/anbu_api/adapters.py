"""벤더 어댑터 — 핏빗/삼성헬스 페이로드를 표준 샘플로 정규화.

기기마다 단위·필드·완결성이 다르다는 것이 웨어러블 통합의 고질병이므로,
정규화는 전부 여기서 끝내고 나머지 파이프라인은 표준 샘플만 다룬다.
새 벤더 추가 = 이 파일에 normalize_<vendor>() 하나 추가.
"""

from __future__ import annotations

from datetime import datetime
from typing import Callable

from .ingest import RawSample

# 핏빗 수면 레벨 중 '수면 중'으로 치는 값 (wake/restless 제외)
_FITBIT_ASLEEP = {"asleep", "light", "deep", "rem"}


def normalize_fitbit(payload: dict) -> list[RawSample]:
    """핏빗 Web API 응답 형태를 표준 샘플로.

    지원 필드:
      activities-steps: [{dateTime, value}]                       → steps_day
      sleep: [{endTime, levels.data[{dateTime, level, seconds}]}] → sleep_stage(기상), night_hr 아님
      activities-heart: [{dateTime, value.restingHeartRate}]      → night_hr (대용 지표)
    """
    out: list[RawSample] = []
    for row in payload.get("activities-steps", []):
        ts = datetime.fromisoformat(row["dateTime"])
        out.append(RawSample(type="steps_day", ts=ts, value=float(row["value"])))
    for sleep in payload.get("sleep", []):
        end = datetime.fromisoformat(sleep["endTime"])
        out.append(RawSample(type="sleep_stage", ts=end, end_ts=end, value=1))
        for seg in (sleep.get("levels", {}) or {}).get("data", []):
            if seg.get("level") in _FITBIT_ASLEEP:
                seg_ts = datetime.fromisoformat(seg["dateTime"])
                out.append(RawSample(type="sleep_stage", ts=seg_ts, end_ts=seg_ts, value=1))
    for row in payload.get("activities-heart", []):
        resting = (row.get("value") or {}).get("restingHeartRate")
        if resting is not None:
            ts = datetime.fromisoformat(row["dateTime"])
            out.append(RawSample(type="night_hr", ts=ts, value=float(resting)))
    return out


def normalize_samsung(payload: dict) -> list[RawSample]:
    """삼성헬스(Health Connect 경유) 내보내기 형태를 표준 샘플로.

    지원 필드:
      steps:      [{date, count}]            → steps_day
      sleep:      [{end_time}]               → sleep_stage(기상)
      heart_rate: [{date, avg_sleep}]        → night_hr
      motion:     [{ts}]                     → motion
    """
    out: list[RawSample] = []
    for row in payload.get("steps", []):
        out.append(RawSample(type="steps_day", ts=datetime.fromisoformat(row["date"]),
                             value=float(row["count"])))
    for row in payload.get("sleep", []):
        end = datetime.fromisoformat(row["end_time"])
        out.append(RawSample(type="sleep_stage", ts=end, end_ts=end, value=1))
    for row in payload.get("heart_rate", []):
        if row.get("avg_sleep") is not None:
            out.append(RawSample(type="night_hr", ts=datetime.fromisoformat(row["date"]),
                                 value=float(row["avg_sleep"])))
    for row in payload.get("motion", []):
        out.append(RawSample(type="motion", ts=datetime.fromisoformat(row["ts"])))
    return out


NORMALIZERS: dict[str, Callable[[dict], list[RawSample]]] = {
    "fitbit": normalize_fitbit,
    "samsung": normalize_samsung,
}
