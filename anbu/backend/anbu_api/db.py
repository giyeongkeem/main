"""SQLite 저장 계층 — 의존성 없이 표준 라이브러리로 유지."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import date, datetime
from typing import Optional

_SCHEMA = """
CREATE TABLE IF NOT EXISTS seniors (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    age       INTEGER NOT NULL,
    dwelling  TEXT NOT NULL DEFAULT '독거',
    district  TEXT NOT NULL DEFAULT '',
    program   TEXT NOT NULL DEFAULT 'b2c'   -- b2c(가족 구독) | b2g(지자체 대상자)
);
CREATE TABLE IF NOT EXISTS days (
    senior_id TEXT NOT NULL,
    day       TEXT NOT NULL,
    steps     INTEGER,
    wake_time INTEGER,
    night_hr  REAL,
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


def connect(path: Optional[str] = None) -> sqlite3.Connection:
    path = path or os.environ.get("ANBU_DB", "anbu.db")
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn


def upsert_senior(conn, sid: str, name: str, age: int, dwelling: str, district: str, program: str) -> None:
    conn.execute(
        "INSERT INTO seniors (id, name, age, dwelling, district, program) VALUES (?,?,?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET name=excluded.name, age=excluded.age, "
        "dwelling=excluded.dwelling, district=excluded.district, program=excluded.program",
        (sid, name, age, dwelling, district, program),
    )
    conn.commit()


def upsert_day(conn, sid: str, day: date, **fields) -> None:
    conn.execute("INSERT OR IGNORE INTO days (senior_id, day) VALUES (?, ?)", (sid, day.isoformat()))
    for col in ("steps", "wake_time", "night_hr"):
        if fields.get(col) is not None:
            conn.execute(
                f"UPDATE days SET {col}=? WHERE senior_id=? AND day=?",
                (fields[col], sid, day.isoformat()),
            )
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
