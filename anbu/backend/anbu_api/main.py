"""안부 API — 하나의 감지 엔진, 두 개의 얼굴(B2C 보호자 / B2G 관제)."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from . import alerts as sm
from . import db as store
from .detection import SEVERITY_ORDER, DayRecord, evaluate

app = FastAPI(title="안부 API", version="0.1.0")
_conn = None


def conn():
    global _conn
    if _conn is None:
        _conn = store.connect()
    return _conn


def _now(now: Optional[datetime] = Query(default=None, description="시뮬레이션용 현재 시각 오버라이드")) -> datetime:
    return now or datetime.now()


# ---------- 등록 · 인제스트 ----------

class SeniorIn(BaseModel):
    id: str
    name: str
    age: int
    dwelling: str = "독거"
    district: str = ""
    program: Literal["b2c", "b2g"] = "b2c"


class Sample(BaseModel):
    """워치/폰 컴패니언 앱이 올리는 원시 샘플."""
    type: Literal["steps_day", "wake_time", "night_hr", "motion"]
    ts: datetime
    value: Optional[float] = None   # motion은 값 없이 ts만 의미가 있다


class IngestIn(BaseModel):
    samples: list[Sample] = Field(min_length=1)


@app.post("/v1/seniors", status_code=201)
def register_senior(body: SeniorIn):
    store.upsert_senior(conn(), body.id, body.name, body.age, body.dwelling, body.district, body.program)
    return {"ok": True, "id": body.id}


@app.post("/v1/seniors/{sid}/ingest")
def ingest(sid: str, body: IngestIn, now: datetime = Depends(_now)):
    c = conn()
    if not c.execute("SELECT 1 FROM seniors WHERE id=?", (sid,)).fetchone():
        raise HTTPException(404, "등록되지 않은 대상자")
    latest_motion = None
    for s in body.samples:
        if s.type == "motion":
            latest_motion = max(latest_motion, s.ts) if latest_motion else s.ts
        elif s.type == "steps_day":
            store.upsert_day(c, sid, s.ts.date(), steps=int(s.value or 0))
        elif s.type == "wake_time":
            store.upsert_day(c, sid, s.ts.date(), wake_time=int(s.value or 0))
        elif s.type == "night_hr":
            store.upsert_day(c, sid, s.ts.date(), night_hr=float(s.value or 0))
    store.touch_device(c, sid, ingest_at=now, motion_at=latest_motion)
    return {"ok": True, "accepted": len(body.samples)}


# ---------- 감지 실행 ----------

def _load_days(c, sid: str) -> list[DayRecord]:
    rows = c.execute("SELECT * FROM days WHERE senior_id=? ORDER BY day", (sid,)).fetchall()
    return [DayRecord(day=date.fromisoformat(r["day"]), steps=r["steps"],
                      wake_time=r["wake_time"], night_hr=r["night_hr"]) for r in rows]


@app.post("/v1/console/recompute")
def recompute(now: datetime = Depends(_now)):
    """전체 대상자 감지 재실행. 신호별로 열린 알림이 없으면 생성, 있으면 갱신."""
    c = conn()
    created, refreshed = 0, 0
    for r in c.execute("SELECT id FROM seniors").fetchall():
        sid = r["id"]
        dev = c.execute("SELECT * FROM device_state WHERE senior_id=?", (sid,)).fetchone()
        last_motion = datetime.fromisoformat(dev["last_motion"]) if dev and dev["last_motion"] else None
        last_ingest = datetime.fromisoformat(dev["last_ingest"]) if dev and dev["last_ingest"] else None
        for sig in evaluate(_load_days(c, sid), last_motion, last_ingest, now):
            existing = store.open_alert(c, sid, sig.kind)
            if existing:
                store.update_alert(c, existing["id"], now, message=sig.message, evidence=sig.evidence)
                refreshed += 1
            else:
                store.create_alert(c, sid, sig.kind, sig.severity, sig.message,
                                   sm.initial_state(sig.severity), sig.evidence, now)
                created += 1
    return {"ok": True, "created": created, "refreshed": refreshed}


# ---------- B2G: 관제 콘솔 ----------

@app.get("/v1/console/queue")
def console_queue():
    c = conn()
    rows = c.execute(
        "SELECT a.*, s.name, s.age, s.dwelling, s.district FROM alerts a "
        "JOIN seniors s ON s.id = a.senior_id WHERE a.state != 'RESOLVED'"
    ).fetchall()
    items = [{
        "alert_id": r["id"], "senior_id": r["senior_id"],
        "name": r["name"], "age": r["age"], "dwelling": r["dwelling"], "district": r["district"],
        "kind": r["kind"], "severity": r["severity"], "message": r["message"],
        "state": r["state"], "next_action": sm.ACTION_LABEL[r["state"]],
        "evidence": json.loads(r["evidence"]), "since": r["created_at"],
    } for r in rows]
    items.sort(key=lambda x: (SEVERITY_ORDER[x["severity"]], x["since"]))
    return {"queue": items}


@app.get("/v1/console/kpis")
def console_kpis(now: datetime = Depends(_now)):
    c = conn()
    total = c.execute("SELECT COUNT(*) n FROM seniors").fetchone()["n"]
    open_rows = c.execute("SELECT severity, COUNT(*) n FROM alerts WHERE state != 'RESOLVED' GROUP BY severity").fetchall()
    by_sev = {r["severity"]: r["n"] for r in open_rows}
    flagged = c.execute("SELECT COUNT(DISTINCT senior_id) n FROM alerts WHERE state != 'RESOLVED'").fetchone()["n"]
    return {
        "total_seniors": total,
        "confirmed_today": total - flagged,   # 열린 알림이 없으면 정상 신호로 확인된 것
        "warning": by_sev.get("주의", 0),
        "emergency": by_sev.get("긴급", 0),
        "device_check": by_sev.get("점검", 0),
        "as_of": now.isoformat(),
    }


class ActionIn(BaseModel):
    action: Literal["escalate", "resolve"]
    note: str = ""


@app.post("/v1/alerts/{alert_id}/action")
def alert_action(alert_id: int, body: ActionIn, now: datetime = Depends(_now)):
    c = conn()
    row = c.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone()
    if not row:
        raise HTTPException(404, "알림 없음")
    try:
        new_state = sm.escalate(row["state"]) if body.action == "escalate" else sm.resolve(row["state"])
    except sm.TransitionError as e:
        raise HTTPException(409, str(e))
    store.update_alert(c, alert_id, now, state=new_state)
    return {"ok": True, "state": new_state, "next_action": sm.ACTION_LABEL[new_state]}


# ---------- B2C: 보호자 뷰 ----------

@app.get("/v1/guardian/{sid}/today")
def guardian_today(sid: str, now: datetime = Depends(_now)):
    """자녀 앱 홈 화면 한 방 조회 — '평소와 같은가'가 첫 번째 답이다."""
    c = conn()
    senior = c.execute("SELECT * FROM seniors WHERE id=?", (sid,)).fetchone()
    if not senior:
        raise HTTPException(404, "등록되지 않은 대상자")
    days = _load_days(c, sid)
    dev = c.execute("SELECT * FROM device_state WHERE senior_id=?", (sid,)).fetchone()
    last_motion = datetime.fromisoformat(dev["last_motion"]) if dev and dev["last_motion"] else None
    last_ingest = datetime.fromisoformat(dev["last_ingest"]) if dev and dev["last_ingest"] else None
    signals = evaluate(days, last_motion, last_ingest, now)

    today = next((d for d in days if d.day == now.date()), None)
    week = [d for d in days if d.day < now.date()][-7:]
    open_alerts = c.execute(
        "SELECT * FROM alerts WHERE senior_id=? AND state != 'RESOLVED'", (sid,)).fetchall()

    if signals:
        worst = signals[0]
        status = {"긴급": "확인이 필요해요", "주의": "평소와 조금 달라요", "점검": "워치 확인이 필요해요"}[worst.severity]
    else:
        status = "오늘도 평소와 같아요"

    return {
        "senior": {"name": senior["name"], "age": senior["age"]},
        "status_headline": status,
        "signals": [{"kind": s.kind, "severity": s.severity, "message": s.message} for s in signals],
        "today": today and {"steps": today.steps, "wake_time": today.wake_time},
        "week_steps": [{"day": d.day.isoformat(), "steps": d.steps} for d in week],
        "open_alerts": [{"id": a["id"], "state": a["state"], "message": a["message"]} for a in open_alerts],
        "device": {"last_motion": last_motion and last_motion.isoformat(),
                   "last_ingest": last_ingest and last_ingest.isoformat()},
    }
