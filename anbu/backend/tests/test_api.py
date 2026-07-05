"""API 통합 테스트 — 롤업, 인증, 테넌트 분리, 어댑터."""

from datetime import datetime, timedelta

NOW = datetime(2026, 7, 5, 9, 40)


def _register(client, sid="p1", name="테스트", headers=None):
    r = client.post("/v1/seniors", headers=headers or {},
                    json={"id": sid, "name": name, "age": 80})
    assert r.status_code == 201, r.text
    return r.json()


# ---------- 원시 샘플 롤업 ----------

def test_raw_samples_roll_up_into_days(client):
    _register(client)
    day = NOW - timedelta(days=1)
    samples = (
        # 걸음 원시 구간 3개 → 합산 900
        [{"type": "steps_raw", "ts": day.replace(hour=h).isoformat(), "value": 300} for h in (9, 12, 15)]
        # 야간 심박 (02시, 04시) → 평균 63 / 주간 심박(14시)은 무시
        + [{"type": "heart_rate", "ts": day.replace(hour=2).isoformat(), "value": 60},
           {"type": "heart_rate", "ts": day.replace(hour=4).isoformat(), "value": 66},
           {"type": "heart_rate", "ts": day.replace(hour=14).isoformat(), "value": 120}]
        # 수면 세그먼트 종료 06:40 → 기상 400분
        + [{"type": "sleep_stage", "ts": day.replace(hour=1).isoformat(),
            "end_ts": day.replace(hour=6, minute=40).isoformat(), "value": 1}]
    )
    r = client.post("/v1/seniors/p1/ingest", params={"now": NOW.isoformat()},
                    json={"samples": samples})
    assert r.status_code == 200

    g = client.get("/v1/guardian/p1/today", params={"now": NOW.isoformat()}).json()
    week = {w["day"]: w["steps"] for w in g["week_steps"]}
    assert week[day.date().isoformat()] == 900
    # 야간 평균 심박이 detection에 들어가는지는 직접 확인
    from anbu_api.main import _load_days, conn
    d = next(x for x in _load_days(conn(), "p1") if x.day == day.date())
    assert d.night_hr == 63.0
    assert d.wake_time == 400


def test_steps_raw_counts_as_motion(client):
    _register(client)
    r = client.post("/v1/seniors/p1/ingest", params={"now": NOW.isoformat()},
                    json={"samples": [{"type": "steps_raw", "ts": (NOW - timedelta(hours=1)).isoformat(),
                                       "value": 200}]})
    assert r.status_code == 200
    g = client.get("/v1/guardian/p1/today", params={"now": NOW.isoformat()}).json()
    assert g["device"]["last_motion"] is not None


# ---------- 인증 · 테넌트 분리 ----------

def test_strict_mode_rejects_anonymous(strict_client):
    assert strict_client.get("/v1/console/queue").status_code == 401
    assert strict_client.post("/v1/seniors", json={"id": "x", "name": "y", "age": 70}).status_code == 401


def test_device_token_enforced(strict_client):
    org = strict_client.post("/v1/orgs", json={"id": "gu1", "name": "테스트구"}).json()
    creds = _register(strict_client, headers={"X-API-Key": org["api_key"]})

    sample = {"samples": [{"type": "motion", "ts": NOW.isoformat()}]}
    assert strict_client.post("/v1/seniors/p1/ingest", json=sample).status_code == 401
    assert strict_client.post("/v1/seniors/p1/ingest", json=sample,
                              headers={"Authorization": "Bearer wrong-token"}).status_code == 401
    r = strict_client.post("/v1/seniors/p1/ingest", json=sample,
                           headers={"Authorization": f"Bearer {creds['device_token']}"})
    assert r.status_code == 200


def test_guardian_key_enforced(strict_client):
    org = strict_client.post("/v1/orgs", json={"id": "gu2", "name": "테스트구"}).json()
    creds = _register(strict_client, headers={"X-API-Key": org["api_key"]})
    assert strict_client.get("/v1/guardian/p1/today").status_code == 401
    r = strict_client.get("/v1/guardian/p1/today",
                          headers={"X-Guardian-Key": creds["guardian_key"]})
    assert r.status_code == 200


def test_tenant_isolation(strict_client):
    a = strict_client.post("/v1/orgs", json={"id": "gu-a", "name": "A구"}).json()
    b = strict_client.post("/v1/orgs", json={"id": "gu-b", "name": "B구"}).json()
    ha, hb = {"X-API-Key": a["api_key"]}, {"X-API-Key": b["api_key"]}

    creds = _register(strict_client, sid="a1", headers=ha)
    # A구 대상자에게 무움직임 신호 유발
    strict_client.post("/v1/seniors/a1/ingest",
                       params={"now": NOW.isoformat()},
                       headers={"Authorization": f"Bearer {creds['device_token']}"},
                       json={"samples": [{"type": "motion", "ts": (NOW - timedelta(hours=20)).isoformat()}]})
    strict_client.post("/v1/console/recompute", params={"now": NOW.isoformat()}, headers=ha)

    qa = strict_client.get("/v1/console/queue", headers=ha).json()["queue"]
    qb = strict_client.get("/v1/console/queue", headers=hb).json()["queue"]
    assert len(qa) == 1 and qa[0]["senior_id"] == "a1"
    assert qb == []  # B구에는 보이지 않는다

    # B구 키로 A구 알림 조치 시도 → 404
    r = strict_client.post(f"/v1/alerts/{qa[0]['alert_id']}/action", headers=hb,
                           json={"action": "resolve"})
    assert r.status_code == 404


# ---------- 벤더 어댑터 ----------

def test_fitbit_adapter_normalizes_and_ingests(client):
    _register(client)
    day = (NOW - timedelta(days=1)).date().isoformat()
    payload = {
        "activities-steps": [{"dateTime": day, "value": "4123"}],
        "sleep": [{"endTime": f"{day}T06:35:00"}],
        "activities-heart": [{"dateTime": day, "value": {"restingHeartRate": 61}}],
    }
    r = client.post("/v1/adapters/fitbit/p1", params={"now": NOW.isoformat()}, json=payload)
    assert r.status_code == 200
    assert r.json()["normalized"] == 3

    from anbu_api.main import _load_days, conn
    d = next(x for x in _load_days(conn(), "p1") if x.day.isoformat() == day)
    assert d.steps == 4123 and d.wake_time == 395 and d.night_hr == 61


def test_samsung_adapter(client):
    _register(client)
    day = (NOW - timedelta(days=1)).date().isoformat()
    payload = {
        "steps": [{"date": day, "count": 3500}],
        "sleep": [{"end_time": f"{day}T07:10:00"}],
        "heart_rate": [{"date": day, "avg_sleep": 64.5}],
        "motion": [{"ts": f"{day}T21:00:00"}],
    }
    r = client.post("/v1/adapters/samsung/p1", params={"now": NOW.isoformat()}, json=payload)
    assert r.status_code == 200
    assert r.json()["normalized"] == 4


def test_unknown_vendor_404(client):
    _register(client)
    assert client.post("/v1/adapters/garmin/p1", json={}).status_code == 404


# ---------- 데모 시드 ----------

def test_demo_seed_creates_alerts(client):
    r = client.post("/v1/demo/seed", params={"now": NOW.isoformat()})
    assert r.status_code == 200
    body = r.json()
    assert body["seniors"] == 12 and body["alerts_created"] >= 5
    kpi = client.get("/v1/console/kpis", params={"now": NOW.isoformat()}).json()
    assert kpi["emergency"] == 1 and kpi["device_check"] == 1


# ---------- 낙상 · 워치 본인 응답 ----------

def test_fall_report_creates_emergency_and_watch_can_resolve(strict_client):
    org = strict_client.post("/v1/orgs", json={"id": "gu3", "name": "테스트구"}).json()
    creds = _register(strict_client, headers={"X-API-Key": org["api_key"]})
    dev = {"Authorization": f"Bearer {creds['device_token']}"}

    r = strict_client.post("/v1/seniors/p1/fall", headers=dev,
                           params={"now": NOW.isoformat()},
                           json={"ts": NOW.isoformat(), "confirmed": True})
    assert r.status_code == 201
    alert_id = r.json()["alert_id"]
    assert r.json()["state"] == "WORKER"  # 긴급 → 방문 직행

    # 같은 낙상이 중복 보고돼도 알림은 하나
    r2 = strict_client.post("/v1/seniors/p1/fall", headers=dev,
                            params={"now": NOW.isoformat()},
                            json={"ts": NOW.isoformat(), "confirmed": True})
    assert r2.json()["alert_id"] == alert_id

    # 워치 '괜찮아요' → 본인 디바이스 토큰으로 종결
    r3 = strict_client.post(f"/v1/alerts/{alert_id}/action", headers=dev,
                            params={"now": NOW.isoformat()}, json={"action": "resolve"})
    assert r3.status_code == 200 and r3.json()["state"] == "RESOLVED"


def test_watch_cannot_touch_other_seniors_alert(strict_client):
    org = strict_client.post("/v1/orgs", json={"id": "gu4", "name": "테스트구"}).json()
    h = {"X-API-Key": org["api_key"]}
    c1 = _register(strict_client, sid="w1", headers=h)
    c2 = _register(strict_client, sid="w2", headers=h)
    r = strict_client.post("/v1/seniors/w1/fall",
                           headers={"Authorization": f"Bearer {c1['device_token']}"},
                           params={"now": NOW.isoformat()},
                           json={"ts": NOW.isoformat()})
    alert_id = r.json()["alert_id"]
    # 다른 어르신 워치 토큰으로 조치 시도 → 404
    r2 = strict_client.post(f"/v1/alerts/{alert_id}/action",
                            headers={"Authorization": f"Bearer {c2['device_token']}"},
                            json={"action": "resolve"})
    assert r2.status_code == 404
