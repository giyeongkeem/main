"""엔드투엔드 데모 — 데모 시드(12명 × 14일)를 주입하고
감지 → 관제 대기열 → 조치 → 보호자 뷰까지 전체 플로우를 실행한다.

실행:  cd anbu/backend && python ../scripts/simulate.py
서버 없이 FastAPI 앱을 인프로세스로 호출하므로 포트가 필요 없다.
"""

from __future__ import annotations

import os
import sys
import tempfile
from datetime import datetime

os.environ["ANBU_DB"] = os.path.join(tempfile.gettempdir(), "anbu-demo.db")
if os.path.exists(os.environ["ANBU_DB"]):
    os.remove(os.environ["ANBU_DB"])

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from anbu_api.main import app  # noqa: E402

NOW = datetime(2026, 7, 5, 9, 40)
client = TestClient(app)


def post(path, **kw):
    r = client.post(path, **kw)
    assert r.status_code in (200, 201), (path, r.status_code, r.text)
    return r.json()


def main():
    seeded = post("/v1/demo/seed", params={"now": NOW.isoformat()})
    print(f"■ 데모 시드: 대상자 {seeded['seniors']}명 · 알림 {seeded['alerts_created']}건 생성\n")

    kpi = client.get("/v1/console/kpis", params={"now": NOW.isoformat()}).json()
    print(f"■ 관제 KPI  대상자 {kpi['total_seniors']}명 · 안부 확인 {kpi['confirmed_today']}명"
          f" · 주의 {kpi['warning']} · 긴급 {kpi['emergency']} · 점검 {kpi['device_check']}\n")

    queue = client.get("/v1/console/queue").json()["queue"]
    print("■ 우선 대응 대기열 (위험도순)")
    for q in queue:
        print(f"  [{q['severity']}] {q['name']}({q['age']}·{q['dwelling']}·{q['district']})"
              f" — {q['message']}  → 다음 조치: {q['next_action']}")

    emergency = next(q for q in queue if q["severity"] == "긴급")
    print(f"\n■ 조치 시연 — {emergency['name']} 긴급 건")
    r = post(f"/v1/alerts/{emergency['alert_id']}/action",
             params={"now": NOW.isoformat()}, json={"action": "resolve", "note": "방문 확인, 이상 없음"})
    print(f"  방문 출동 → 확인 완료 → 상태: {r['state']}")

    warning = next(q for q in queue if q["severity"] == "주의")
    r = post(f"/v1/alerts/{warning['alert_id']}/action",
             params={"now": NOW.isoformat()}, json={"action": "escalate", "note": "AI 전화 무응답"})
    print(f"  {warning['name']} 주의 건: AI 안부전화 무응답 → 상향 → 다음 조치: {r['next_action']}")

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
