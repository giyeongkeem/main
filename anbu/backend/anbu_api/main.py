"""안부 API — 하나의 감지 엔진, 두 개의 얼굴(B2C 보호자 / B2G 관제).

인증(운영 모드 ANBU_REQUIRE_AUTH=1):
  관제·등록·웹훅  X-API-Key: <org api_key>        (테넌트 스코프)
  인제스트        Authorization: Bearer <device_token>
  보호자 조회     X-Guardian-Key: <guardian_key>
데모 모드(기본)에서는 자격 증명 없이 'demo' 조직으로 동작한다.
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Literal, Optional

from datetime import timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import alerts as sm
from . import auth
from . import db as store
from . import demo as demo_seed
from .adapters import NORMALIZERS
from .detection import SEVERITY_ORDER, DayRecord, evaluate
from .ingest import RawSample, apply_samples

app = FastAPI(title="안부 API", version="0.2.0")

_conns: dict = {}


def conn():
    path = os.environ.get("ANBU_DB", "anbu.db")
    if path not in _conns:
        _conns[path] = store.connect(path)
    return _conns[path]


def _now(now: Optional[datetime] = Query(default=None, description="시뮬레이션용 현재 시각 오버라이드")) -> datetime:
    if now:
        return now
    # UTC 서버에서 사용자 벽시계(예: KST) 의미론을 맞추기 위한 오프셋 (Render 배포 시 9)
    offset = float(os.environ.get("ANBU_TZ_OFFSET_HOURS", "0"))
    return datetime.now() + timedelta(hours=offset)


def _org(x_api_key: Optional[str] = Header(default=None)):
    return auth.require_org(conn(), x_api_key)


# ---------- 조직 · 등록 ----------

class OrgIn(BaseModel):
    id: str
    name: str


@app.post("/v1/orgs", status_code=201)
def create_org(body: OrgIn):
    """신규 테넌트 발급. 운영에서는 별도 어드민 채널로만 노출한다."""
    try:
        api_key = store.create_org(conn(), body.id, body.name)
    except Exception:
        raise HTTPException(409, "이미 존재하는 조직 ID")
    return {"ok": True, "id": body.id, "api_key": api_key}


class SeniorIn(BaseModel):
    id: str
    name: str
    age: int
    dwelling: str = "독거"
    district: str = ""
    program: Literal["b2c", "b2g"] = "b2c"


@app.post("/v1/seniors", status_code=201)
def register_senior(body: SeniorIn, org=Depends(_org)):
    creds = store.upsert_senior(conn(), body.id, org["id"], body.name, body.age,
                                body.dwelling, body.district, body.program)
    # 토큰은 등록 응답에서 한 번만 노출 — 온보딩 시 기기/보호자 앱에 저장
    return {"ok": True, "id": body.id, **creds}


# ---------- 인제스트 ----------

class Sample(BaseModel):
    """워치/폰 컴패니언 앱이 올리는 샘플 (집계값 또는 원시값)."""
    type: Literal["steps_day", "wake_time", "night_hr",
                  "steps_raw", "heart_rate", "sleep_stage", "motion"]
    ts: datetime
    value: Optional[float] = None
    end_ts: Optional[datetime] = None


class IngestIn(BaseModel):
    samples: list[Sample] = Field(min_length=1)


@app.post("/v1/seniors/{sid}/ingest")
def ingest(sid: str, body: IngestIn, now: datetime = Depends(_now),
           authorization: Optional[str] = Header(default=None)):
    auth.require_device(conn(), sid, authorization)
    accepted = apply_samples(conn(), sid,
                             [RawSample(s.type, s.ts, s.value, s.end_ts) for s in body.samples],
                             now=now)
    return {"ok": True, "accepted": accepted}


class FallIn(BaseModel):
    ts: datetime
    confirmed: bool = True


@app.post("/v1/seniors/{sid}/fall", status_code=201)
def report_fall(sid: str, body: FallIn, now: datetime = Depends(_now),
                authorization: Optional[str] = Header(default=None)):
    """워치 낙상 감지 전용 채널 — 인제스트 파이프라인을 우회해 즉시 알림을 만든다."""
    auth.require_device(conn(), sid, authorization)
    c = conn()
    severity = "긴급" if body.confirmed else "주의"
    existing = store.open_alert(c, sid, "fall")
    message = f"낙상 감지 ({body.ts.strftime('%H:%M')}) · " + ("본인 확인/무응답" if body.confirmed else "오탐 가능")
    if existing:
        store.update_alert(c, existing["id"], now, message=message)
        return {"ok": True, "alert_id": existing["id"], "state": existing["state"]}
    state = sm.initial_state(severity)
    alert_id = store.create_alert(c, sid, "fall", severity, message, state,
                                  {"confirmed": body.confirmed, "ts": body.ts.isoformat()}, now)
    return {"ok": True, "alert_id": alert_id, "state": state}


@app.post("/v1/adapters/{vendor}/{sid}")
def vendor_webhook(vendor: str, sid: str, payload: dict,
                   now: datetime = Depends(_now),
                   token: Optional[str] = Query(default=None, description="디바이스 토큰 (개인 테스트용 — 헤더 설정이 어려운 앱을 위해 쿼리로도 허용)"),
                   x_api_key: Optional[str] = Header(default=None)):
    """핏빗/삼성헬스/Health Auto Export 동기화.

    인증 2택: 조직 키(서버-투-서버) 또는 본인 디바이스 토큰(?token= — HAE처럼
    헤더 커스터마이즈가 번거로운 개인용 앱 경로).
    """
    normalize = NORMALIZERS.get(vendor)
    if normalize is None:
        raise HTTPException(404, f"지원하지 않는 벤더: {vendor} (지원: {', '.join(NORMALIZERS)})")
    c = conn()
    if token:
        senior = c.execute("SELECT * FROM seniors WHERE id=?", (sid,)).fetchone()
        if senior is None or senior["device_token"] != token:
            raise HTTPException(401, "디바이스 토큰 불일치")
    else:
        org = auth.require_org(c, x_api_key)
        senior = c.execute("SELECT * FROM seniors WHERE id=? AND org_id=?", (sid, org["id"])).fetchone()
        if senior is None:
            raise HTTPException(404, "이 조직에 등록되지 않은 대상자")
    samples = normalize(payload)
    accepted = apply_samples(c, sid, samples, now=now)
    return {"ok": True, "normalized": len(samples), "accepted": accepted}


# ---------- 개인 테스트 온보딩 ----------

class PersonalIn(BaseModel):
    name: str
    age: int = 30
    id: str = "me"


@app.post("/v1/personal/register", status_code=201)
def personal_register(body: PersonalIn, request: Request,
                      code: Optional[str] = Query(default=None)):
    """본인 애플워치 테스트용 원스텝 온보딩 — 등록 + 연동 URL 일체 발급.

    운영 모드에서는 ANBU_SETUP_CODE 환경변수와 일치하는 ?code= 가 필요하다.
    """
    setup_code = os.environ.get("ANBU_SETUP_CODE")
    if os.environ.get("ANBU_REQUIRE_AUTH") == "1":
        if not setup_code:
            raise HTTPException(403, "서버에 ANBU_SETUP_CODE가 설정되지 않았습니다")
        if code != setup_code:
            raise HTTPException(401, "설정 코드(?code=)가 일치하지 않습니다")
    c = conn()
    org = c.execute("SELECT * FROM orgs WHERE id='personal'").fetchone()
    if org is None:
        api_key = store.create_org(c, "personal", "개인 테스트")
    else:
        api_key = org["api_key"]
    creds = store.upsert_senior(c, body.id, "personal", body.name, body.age,
                                "본인", "개인 테스트", "b2c")
    base = str(request.base_url).rstrip("/")
    return {
        "ok": True, "id": body.id, **creds, "org_api_key": api_key,
        "hae_url": f"{base}/v1/adapters/health-auto-export/{body.id}?token={creds['device_token']}",
        "guardian_dashboard": f"{base}/app/?view=guardian&senior={body.id}&gkey={creds['guardian_key']}",
        "console_dashboard": f"{base}/app/?org_key={api_key}",
        "next": "아이폰 'Health Auto Export' 앱 → REST API 자동화에 hae_url을 붙여넣으세요. "
                "자세한 절차는 anbu/docs/personal-testing.md 참고.",
    }


# ---------- 감지 실행 ----------

def _effective_night_hr(row) -> Optional[float]:
    if row["night_hr"] is not None:
        return row["night_hr"]
    if row["night_hr_n"]:
        return row["night_hr_sum"] / row["night_hr_n"]
    return None


def _load_days(c, sid: str) -> list[DayRecord]:
    rows = c.execute("SELECT * FROM days WHERE senior_id=? ORDER BY day", (sid,)).fetchall()
    return [DayRecord(day=date.fromisoformat(r["day"]), steps=r["steps"],
                      wake_time=r["wake_time"], night_hr=_effective_night_hr(r)) for r in rows]


def _signals_for(c, sid: str, now: datetime):
    dev = c.execute("SELECT * FROM device_state WHERE senior_id=?", (sid,)).fetchone()
    last_motion = datetime.fromisoformat(dev["last_motion"]) if dev and dev["last_motion"] else None
    last_ingest = datetime.fromisoformat(dev["last_ingest"]) if dev and dev["last_ingest"] else None
    return evaluate(_load_days(c, sid), last_motion, last_ingest, now), last_motion, last_ingest


@app.post("/v1/console/recompute")
def recompute(now: datetime = Depends(_now), org=Depends(_org)):
    """조직 대상자 전체 감지 재실행. 운영에서는 스케줄러가 10분 주기로 호출."""
    c = conn()
    created, refreshed = 0, 0
    for r in c.execute("SELECT id FROM seniors WHERE org_id=?", (org["id"],)).fetchall():
        sid = r["id"]
        signals, _, _ = _signals_for(c, sid, now)
        for sig in signals:
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
def console_queue(org=Depends(_org)):
    c = conn()
    rows = c.execute(
        "SELECT a.*, s.name, s.age, s.dwelling, s.district FROM alerts a "
        "JOIN seniors s ON s.id = a.senior_id WHERE a.state != 'RESOLVED' AND s.org_id=?",
        (org["id"],)).fetchall()
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
def console_kpis(now: datetime = Depends(_now), org=Depends(_org)):
    c = conn()
    total = c.execute("SELECT COUNT(*) n FROM seniors WHERE org_id=?", (org["id"],)).fetchone()["n"]
    open_rows = c.execute(
        "SELECT a.severity, COUNT(*) n FROM alerts a JOIN seniors s ON s.id=a.senior_id "
        "WHERE a.state != 'RESOLVED' AND s.org_id=? GROUP BY a.severity", (org["id"],)).fetchall()
    by_sev = {r["severity"]: r["n"] for r in open_rows}
    flagged = c.execute(
        "SELECT COUNT(DISTINCT a.senior_id) n FROM alerts a JOIN seniors s ON s.id=a.senior_id "
        "WHERE a.state != 'RESOLVED' AND s.org_id=?", (org["id"],)).fetchone()["n"]
    return {
        "total_seniors": total,
        "confirmed_today": total - flagged,
        "warning": by_sev.get("주의", 0),
        "emergency": by_sev.get("긴급", 0),
        "device_check": by_sev.get("점검", 0),
        "as_of": now.isoformat(),
    }


class ActionIn(BaseModel):
    action: Literal["escalate", "resolve"]
    note: str = ""


@app.post("/v1/alerts/{alert_id}/action")
def alert_action(alert_id: int, body: ActionIn, now: datetime = Depends(_now),
                 x_api_key: Optional[str] = Header(default=None),
                 authorization: Optional[str] = Header(default=None)):
    """조치: 관제(조직 키) 또는 본인 워치(디바이스 토큰, '괜찮아요'/'도움 필요' 응답)."""
    c = conn()
    if authorization and authorization.startswith("Bearer ") and not x_api_key:
        senior = store.senior_by_token(c, authorization.removeprefix("Bearer "))
        if senior is None:
            raise HTTPException(401, "디바이스 토큰 불일치")
        row = c.execute("SELECT * FROM alerts WHERE id=? AND senior_id=?",
                        (alert_id, senior["id"])).fetchone()
    else:
        org = auth.require_org(c, x_api_key)
        row = c.execute(
            "SELECT a.* FROM alerts a JOIN seniors s ON s.id=a.senior_id WHERE a.id=? AND s.org_id=?",
            (alert_id, org["id"])).fetchone()
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
def guardian_today(sid: str, now: datetime = Depends(_now),
                   x_guardian_key: Optional[str] = Header(default=None)):
    """자녀 앱 홈 화면 한 방 조회 — '평소와 같은가'가 첫 번째 답이다."""
    c = conn()
    senior = auth.require_guardian(c, sid, x_guardian_key)
    days = _load_days(c, sid)
    signals, last_motion, last_ingest = _signals_for(c, sid, now)

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


# ---------- 데모 · 라이브 대시보드 ----------

@app.post("/v1/demo/seed")
def demo_reseed(now: datetime = Depends(_now), org=Depends(_org)):
    """데모 데이터 재생성 + 감지 실행. 라이브 대시보드의 '재생성' 버튼용."""
    result = demo_seed.seed(conn(), now, org_id=org["id"])
    recompute_result = recompute(now=now, org=org)
    return {**result, "alerts_created": recompute_result["created"]}


@app.get("/")
def root():
    return RedirectResponse("/app/")


_web = Path(__file__).parent / "web"
if _web.is_dir():
    app.mount("/app", StaticFiles(directory=_web, html=True), name="web")
