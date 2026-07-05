"""SQLite 저장 계층 — 의존성 없이 표준 라이브러리로 유지."""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
from datetime import date, datetime
from typing import Optional

_SCHEMA = """
CREATE TABLE IF NOT EXISTS orgs (
    id      TEXT PRIMARY KEY,          -- 예: seongdong-gu, anbu-b2c
    name    TEXT NOT NULL,
    api_key TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS seniors (
    id           TEXT PRIMARY KEY,
    org_id       TEXT NOT NULL DEFAULT 'demo',
    name         TEXT NOT NULL,
    age          INTEGER NOT NULL,
    dwelling     TEXT NOT NULL DEFAULT '독거',
    district     TEXT NOT NULL DEFAULT '',
    program      TEXT NOT NULL DEFAULT 'b2c',  -- b2c(가족 구독) | b2g(지자체 대상자)
    device_token TEXT,                          -- 워치/폰 인제스트용
    guardian_key TEXT                           -- 자녀 앱 조회용
);
CREATE TABLE IF NOT EXISTS days (
    senior_id    TEXT NOT NULL,
    day          TEXT NOT NULL,
    steps        INTEGER,
    wake_time    INTEGER,
    night_hr     REAL,          -- 집계값 직접 인제스트 시
    night_hr_sum REAL DEFAULT 0, -- 원시 심박 롤업용 (00~06시 구간)
    night_hr_n   INTEGER DEFAULT 0,
    PRIMARY KEY (senior_id, day)
);
CREATE TABLE IF NOT EXISTS device_state (
    senior_id   TEXT PRIMARY KEY,
    last_motion TEXT,
    last_ingest TEXT
);
CREATE TABLE IF NOT EXISTS alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    senior_id  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    severity   TEXT NOT NULL,
    message    TEXT NOT NULL,
    state      TEXT NOT NULL,
    evidence   TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

# 데모 테넌트 — ANBU_REQUIRE_AUTH=1이 아니면 이 조직으로 열려 있다
DEMO_ORG = ("demo", "안부 데모", "demo-key")


def connect(path: Optional[str] = None) -> sqlite3.Connection:
    path = path or os.environ.get("ANBU_DB", "anbu.db")
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    conn.execute("INSERT OR IGNORE INTO orgs (id, name, api_key) VALUES (?,?,?)", DEMO_ORG)
    conn.commit()
    return conn


# ---------- 조직 (테넌트) ----------

def create_org(conn, org_id: str, name: str) -> str:
    api_key = f"anbu_{secrets.token_urlsafe(24)}"
    conn.execute("INSERT INTO orgs (id, name, api_key) VALUES (?,?,?)", (org_id, name, api_key))
    conn.commit()
    return api_key


def org_by_key(conn, api_key: str) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM orgs WHERE api_key=?", (api_key,)).fetchone()


# ---------- 대상자 ----------

def upsert_senior(conn, sid: str, org_id: str, name: str, age: int,
                  dwelling: str, district: str, program: str) -> dict:
    row = conn.execute("SELECT device_token, guardian_key FROM seniors WHERE id=?", (sid,)).fetchone()
    device_token = row["device_token"] if row and row["device_token"] else f"dev_{secrets.token_urlsafe(18)}"
    guardian_key = row["guardian_key"] if row and row["guardian_key"] else f"gk_{secrets.token_urlsafe(18)}"
    conn.execute(
        "INSERT INTO seniors (id, org_id, name, age, dwelling, district, program, device_token, guardian_key) "
        "VALUES (?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET org_id=excluded.org_id, name=excluded.name, age=excluded.age, "
        "dwelling=excluded.dwelling, district=excluded.district, program=excluded.program",
        (sid, org_id, name, age, dwelling, district, program, device_token, guardian_key),
    )
    conn.commit()
    return {"device_token": device_token, "guardian_key": guardian_key}


def senior_by_token(conn, token: str) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM seniors WHERE device_token=?", (token,)).fetchone()


# ---------- 일 단위 데이터 ----------

def upsert_day(conn, sid: str, day: date, **fields) -> None:
    conn.execute("INSERT OR IGNORE INTO days (senior_id, day) VALUES (?, ?)", (sid, day.isoformat()))
    for col in ("steps", "wake_time", "night_hr"):
        if fields.get(col) is not None:
            conn.execute(f"UPDATE days SET {col}=? WHERE senior_id=? AND day=?",
                         (fields[col], sid, day.isoformat()))
    conn.commit()


def add_steps(conn, sid: str, day: date, delta: int) -> None:
    """원시 걸음 샘플 롤업 — 일 합산."""
    conn.execute("INSERT OR IGNORE INTO days (senior_id, day) VALUES (?, ?)", (sid, day.isoformat()))
    conn.execute("UPDATE days SET steps = COALESCE(steps, 0) + ? WHERE senior_id=? AND day=?",
                 (delta, sid, day.isoformat()))
    conn.commit()


def add_night_hr_sample(conn, sid: str, day: date, bpm: float) -> None:
    """야간(00~06시) 심박 원시 샘플 롤업 — 증분 평균."""
    conn.execute("INSERT OR IGNORE INTO days (senior_id, day) VALUES (?, ?)", (sid, day.isoformat()))
    conn.execute(
        "UPDATE days SET night_hr_sum = night_hr_sum + ?, night_hr_n = night_hr_n + 1 "
        "WHERE senior_id=? AND day=?",
        (bpm, sid, day.isoformat()))
    conn.commit()


def raise_wake_time(conn, sid: str, day: date, minutes: int) -> None:
    """수면 세그먼트 종료 시각 롤업 — 아침 구간의 최댓값이 기상 시각."""
    conn.execute("INSERT OR IGNORE INTO days (senior_id, day) VALUES (?, ?)", (sid, day.isoformat()))
    conn.execute(
        "UPDATE days SET wake_time = MAX(COALESCE(wake_time, 0), ?) WHERE senior_id=? AND day=?",
        (minutes, sid, day.isoformat()))
    conn.commit()


def touch_device(conn, sid: str, ingest_at: datetime, motion_at: Optional[datetime]) -> None:
    row = conn.execute("SELECT last_motion FROM device_state WHERE senior_id=?", (sid,)).fetchone()
    prev_motion = datetime.fromisoformat(row["last_motion"]) if row and row["last_motion"] else None
    if motion_at is not None and (prev_motion is None or motion_at > prev_motion):
        new_motion = motion_at
    else:
        new_motion = prev_motion
    conn.execute(
        "INSERT INTO device_state (senior_id, last_motion, last_ingest) VALUES (?,?,?) "
        "ON CONFLICT(senior_id) DO UPDATE SET last_motion=?, last_ingest=?",
        (sid, new_motion and new_motion.isoformat(), ingest_at.isoformat(),
         new_motion and new_motion.isoformat(), ingest_at.isoformat()),
    )
    conn.commit()


# ---------- 알림 ----------

def open_alert(conn, sid: str, kind: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM alerts WHERE senior_id=? AND kind=? AND state != 'RESOLVED' "
        "ORDER BY id DESC LIMIT 1",
        (sid, kind),
    ).fetchone()


def create_alert(conn, sid: str, kind: str, severity: str, message: str,
                 state: str, evidence: dict, now: datetime) -> int:
    cur = conn.execute(
        "INSERT INTO alerts (senior_id, kind, severity, message, state, evidence, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (sid, kind, severity, message, state, json.dumps(evidence, ensure_ascii=False),
         now.isoformat(), now.isoformat()),
    )
    conn.commit()
    return cur.lastrowid


def update_alert(conn, alert_id: int, now: datetime, *, state: Optional[str] = None,
                 message: Optional[str] = None, evidence: Optional[dict] = None) -> None:
    if state is not None:
        conn.execute("UPDATE alerts SET state=?, updated_at=? WHERE id=?", (state, now.isoformat(), alert_id))
    if message is not None:
        conn.execute("UPDATE alerts SET message=?, updated_at=? WHERE id=?", (message, now.isoformat(), alert_id))
    if evidence is not None:
        conn.execute("UPDATE alerts SET evidence=?, updated_at=? WHERE id=?",
                     (json.dumps(evidence, ensure_ascii=False), now.isoformat(), alert_id))
    conn.commit()
