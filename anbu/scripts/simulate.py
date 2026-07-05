"""엔드투엔드 데모 — 가상 대상자 12명, 14일치 데이터를 API로 주입하고
감지 → 관제 대기열 → 조치 → 보호자 뷰까지 전체 플로우를 실행한다.

실행:  cd anbu/backend && ANBU_DB=/tmp/anbu-demo.db python ../scripts/simulate.py
서버 없이 FastAPI 앱을 인프로세스로 호출하므로 포트가 필요 없다.
"""

from __future__ import annotations

import os
import random
import sys
from datetime import datetime, timedelta

os.environ.setdefault("ANBU_DB", "/tmp/anbu-demo.db")
if os.path.exists(os.environ["ANBU_DB"]):
    os.remove(os.environ["ANBU_DB"])

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from anbu_api.main import app  # noqa: E402

NOW = datetime(2026, 7, 5, 9, 40)
rng = random.Random(20260705)
client = TestClient(app)


def post(path, **kw):
    r = client.post(path, **kw)
    assert r.status_code in (200, 201), (path, r.status_code, r.text)
    return r.json()


SENIORS = [
    # (id, 이름, 나이, 거주, 동, 프로그램, 시나리오)
    ("s01", "이순자", 84, "독거", "금호1가동", "b2g", "no_motion"),
    ("s02", "김만수", 79, "독거", "옥수동", "b2g", "steps_drop"),
    ("s03", "박옥례", 81, "독거", "응봉동", "b2g", "night_hr"),
    ("s04", "최점분", 77, "부부", "금호2가동", "b2g", "late_wake"),
    ("s05", "정재원", 86, "독거", "성수1가동", "b2g", "no_data"),
    ("s06", "박순자", 78, "독거", "행당동", "b2c", None),   # 자녀 구독 — 정상
] + [(f"s{i:02d}", f"대상자{i}", 70 + i % 20, "독거", "성수2가동", "b2g", None) for i in range(7, 13)]


def seed(sid, scenario):
    samples = []
    for back in range(14, 0, -1):
        day = NOW - timedelta(days=back)
        steps = rng.randint(3300, 4300)
        wake = rng.randint(380, 400)          # 06:20~06:40
        hr = rng.uniform(60, 64)

        if scenario == "steps_drop" and back <= 3:
            steps = rng.randint(700, 1000)     # 3일 연속 급감
        if scenario == "night_hr" and back <= 3:
            hr = rng.uniform(79, 83)           # 3일 밤 연속 +15bpm 이상
        if scenario == "no_data" and back <= 3:
            continue                           # 최근 3일 무수신 (미충전)

        samples += [
            {"type": "steps_day", "ts": day.isoformat(), "value": steps},
            {"type": "wake_time", "ts": day.isoformat(), "value": wake},
            {"type": "night_hr", "ts": day.isoformat(), "value": round(hr, 1)},
        ]

    # 오늘 데이터와 마지막 움직임
    if scenario == "no_motion":
        motion = NOW - timedelta(hours=18)     # 어제 오후 이후 무움직임
        samples.append({"type": "motion", "ts": motion.isoformat()})
        ingest_at = NOW - timedelta(minutes=10)
    elif scenario == "no_data":
        motion = NOW - timedelta(days=3, hours=2)
        samples.append({"type": "motion", "ts": motion.isoformat()})
        ingest_at = NOW - timedelta(hours=52)  # 52시간 무수신
    elif scenario == "late_wake":
        motion = NOW - timedelta(hours=11)     # 어젯밤 이후 오늘 기상 미감지
        samples.append({"type": "motion", "ts": motion.isoformat()})
        ingest_at = NOW - timedelta(minutes=20)
    else:
        samples += [
            {"type": "wake_time", "ts": NOW.isoformat(), "value": 402},  # 오늘 06:42 기상
            {"type": "steps_day", "ts": NOW.isoformat(), "value": 1200},
        ]
        samples.append({"type": "motion", "ts": (NOW - timedelta(minutes=5)).isoformat()})
        ingest_at = NOW - timedelta(minutes=5)

    post(f"/v1/seniors/{sid}/ingest", params={"now": ingest_at.isoformat()},
         json={"samples": samples})


def main():
    for sid, name, age, dwelling, district, program, scenario in SENIORS:
        post("/v1/seniors", json={"id": sid, "name": name, "age": age, "dwelling": dwelling,
                                  "district": district, "program": program})
        seed(sid, scenario)

    res = post("/v1/console/recompute", params={"now": NOW.isoformat()})
    print(f"■ 감지 실행: 알림 {res['created']}건 생성\n")

    kpi = client.get("/v1/console/kpis", params={"now": NOW.isoformat()}).json()
    print(f"■ 관제 KPI  대상자 {kpi['total_seniors']}명 · 안부 확인 {kpi['confirmed_today']}명"
          f" · 주의 {kpi['warning']} · 긴급 {kpi['emergency']} · 점검 {kpi['device_check']}\n")

    queue = client.get("/v1/console/queue").json()["queue"]
    print("■ 우선 대응 대기열 (위험도순)")
    for q in queue:
        print(f"  [{q['severity']}] {q['name']}({q['age']}·{q['dwelling']}·{q['district']})"
              f" — {q['message']}  → 다음 조치: {q['next_action']}")

    # 조치 시연: 긴급 건 방문 출동 → 이상 없음 확인 → 종결
    emergency = next(q for q in queue if q["severity"] == "긴급")
    print(f"\n■ 조치 시연 — {emergency['name']} 긴급 건")
    r = post(f"/v1/alerts/{emergency['alert_id']}/action",
             params={"now": NOW.isoformat()}, json={"action": "resolve", "note": "방문 확인, 이상 없음"})
    print(f"  방문 출동 → 확인 완료 → 상태: {r['state']}")

    # 주의 건 하나는 AI 전화 무응답 → 복지사 상향 시연
    warning = next(q for q in queue if q["severity"] == "주의")
    r = post(f"/v1/alerts/{warning['alert_id']}/action",
             params={"now": NOW.isoformat()}, json={"action": "escalate", "note": "AI 전화 무응답"})
    print(f"  {warning['name']} 주의 건: AI 안부전화 무응답 → 상향 → 다음 조치: {r['next_action']}")

    # B2C 보호자 뷰
    g = client.get("/v1/guardian/s06/today", params={"now": NOW.isoformat()}).json()
    print(f"\n■ 자녀 앱 (박순자 어르신 보호자 뷰)")
    print(f"  상태: \"{g['status_headline']}\"")
    print(f"  오늘: 걸음 {g['today']['steps']:,}보 · 기상 {g['today']['wake_time']//60:02d}:{g['today']['wake_time']%60:02d}")
    print(f"  최근 7일 걸음: {[w['steps'] for w in g['week_steps']]}")

    kpi = client.get("/v1/console/kpis", params={"now": NOW.isoformat()}).json()
    print(f"\n■ 조치 후 KPI  안부 확인 {kpi['confirmed_today']}명 · 주의 {kpi['warning']}"
          f" · 긴급 {kpi['emergency']} · 점검 {kpi['device_check']}")


if __name__ == "__main__":
    main()
