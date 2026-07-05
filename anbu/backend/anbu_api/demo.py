"""데모 시드 — 가상 대상자 12명 × 14일 데이터를 DB에 직접 주입.

라이브 대시보드의 "데모 데이터 재생성" 버튼과 scripts/simulate.py가 공유한다.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from . import db as store
from .ingest import RawSample, apply_samples

SENIORS = [
    # (id, 이름, 나이, 거주, 동, 프로그램, 시나리오)
    ("s01", "이순자", 84, "독거", "금호1가동", "b2g", "no_motion"),
    ("s02", "김만수", 79, "독거", "옥수동", "b2g", "steps_drop"),
    ("s03", "박옥례", 81, "독거", "응봉동", "b2g", "night_hr"),
    ("s04", "최점분", 77, "부부", "금호2가동", "b2g", "late_wake"),
    ("s05", "정재원", 86, "독거", "성수1가동", "b2g", "no_data"),
    ("s06", "박순자", 78, "독거", "행당동", "b2c", None),   # 자녀 구독 — 정상
] + [(f"s{i:02d}", f"대상자{i}", 70 + i % 20, "독거", "성수2가동", "b2g", None)
     for i in range(7, 13)]


def seed(conn, now: datetime, org_id: str = "demo") -> dict:
    """알림·데이터를 초기화하고 시나리오 데이터를 다시 심는다."""
    rng = random.Random(20260705)
    conn.execute("DELETE FROM alerts")
    conn.execute("DELETE FROM days")
    conn.execute("DELETE FROM device_state")
    conn.commit()

    creds = {}
    for sid, name, age, dwelling, district, program, scenario in SENIORS:
        creds[sid] = store.upsert_senior(conn, sid, org_id, name, age, dwelling, district, program)
        samples: list[RawSample] = []
        for back in range(14, 0, -1):
            day = now - timedelta(days=back)
            steps = rng.randint(3300, 4300)
            wake = rng.randint(380, 400)
            hr = rng.uniform(60, 64)
            if scenario == "steps_drop" and back <= 3:
                steps = rng.randint(700, 1000)
            if scenario == "night_hr" and back <= 3:
                hr = rng.uniform(79, 83)
            if scenario == "no_data" and back <= 3:
                continue
            samples += [
                RawSample(type="steps_day", ts=day, value=steps),
                RawSample(type="wake_time", ts=day, value=wake),
                RawSample(type="night_hr", ts=day, value=round(hr, 1)),
            ]

        if scenario == "no_motion":
            samples.append(RawSample(type="motion", ts=now - timedelta(hours=18)))
            ingest_at = now - timedelta(minutes=10)
        elif scenario == "no_data":
            samples.append(RawSample(type="motion", ts=now - timedelta(days=3, hours=2)))
            ingest_at = now - timedelta(hours=52)
        elif scenario == "late_wake":
            samples.append(RawSample(type="motion", ts=now - timedelta(hours=11)))
            ingest_at = now - timedelta(minutes=20)
        else:
            samples += [
                RawSample(type="wake_time", ts=now, value=402),
                RawSample(type="steps_day", ts=now, value=1200),
                RawSample(type="motion", ts=now - timedelta(minutes=5)),
            ]
            ingest_at = now - timedelta(minutes=5)
        apply_samples(conn, sid, samples, now=ingest_at)

    return {"seniors": len(SENIORS), "guardian_demo": {"senior_id": "s06", **creds["s06"]}}
