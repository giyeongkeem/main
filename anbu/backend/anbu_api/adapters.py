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


def _parse_dt(s: str) -> datetime:
    """HAE는 '2026-07-05 06:42:00 +0900' 형식을 쓴다. 타임존은 벽시계 시각으로
    환원해 버린다(detection은 '그 사람 기준 06:42 기상'이라는 벽시계 의미론을 쓴다)."""
    for fmt in ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=None)
        except ValueError:
            continue
    return datetime.fromisoformat(s).replace(tzinfo=None)


def normalize_health_auto_export(payload: dict) -> list[RawSample]:
    """Health Auto Export(iOS 앱)의 REST API 내보내기 — 개인 애플워치 테스트 경로.

    아이폰 앱스토어의 'Health Auto Export' 앱이 애플 건강 데이터를 이 형식의
    JSON으로 POST해 준다. 앱 빌드 없이 본인 워치 데이터로 전체 파이프라인을
    돌려볼 수 있는 가장 간단한 방법이다.

    payload = {"data": {"metrics": [{"name": "step_count", "data": [{...}]}, ...]}}
    지원 지표: step_count(일 합산), heart_rate(야간 롤업), resting_heart_rate,
              sleep_analysis(수면 종료 → 기상 시각)
    """
    out: list[RawSample] = []
    daily_steps: dict = {}
    latest_activity: datetime | None = None

    for metric in (payload.get("data", {}) or {}).get("metrics", []):
        name, rows = metric.get("name"), metric.get("data", [])
        if name == "step_count":
            for r in rows:
                ts = _parse_dt(r["date"])
                qty = float(r.get("qty") or 0)
                if qty <= 0:
                    continue
                key = ts.date()
                daily_steps[key] = daily_steps.get(key, 0) + qty
                latest_activity = max(latest_activity, ts) if latest_activity else ts
        elif name == "resting_heart_rate":
            for r in rows:
                if r.get("qty") is not None:
                    out.append(RawSample(type="night_hr", ts=_parse_dt(r["date"]),
                                         value=float(r["qty"])))
        elif name == "heart_rate":
            for r in rows:
                bpm = r.get("Avg") or r.get("avg") or r.get("qty")
                if bpm is not None:
                    ts = _parse_dt(r["date"])
                    out.append(RawSample(type="heart_rate", ts=ts, value=float(bpm)))
                    latest_activity = max(latest_activity, ts) if latest_activity else ts
        elif name == "sleep_analysis":
            for r in rows:
                end = r.get("sleepEnd") or r.get("inBedEnd")
                if end:
                    end_ts = _parse_dt(end)
                    out.append(RawSample(type="sleep_stage", ts=end_ts, end_ts=end_ts, value=1))

    for day, total in daily_steps.items():
        out.append(RawSample(type="steps_day",
                             ts=datetime(day.year, day.month, day.day, 12), value=total))
    if latest_activity:
        out.append(RawSample(type="motion", ts=latest_activity))
    return out


NORMALIZERS: dict[str, Callable[[dict], list[RawSample]]] = {
    "fitbit": normalize_fitbit,
    "samsung": normalize_samsung,
    "health-auto-export": normalize_health_auto_export,
    "hae": normalize_health_auto_export,
}
