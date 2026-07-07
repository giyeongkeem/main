"""SQLite 저장소: 세금계산서, 거래처, 공급자(내 사업자) 설정.

파일 경로는 TAX_INVOICE_DB 환경변수로 바꿀 수 있다(기본 tax_invoices.db).
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone

DB_PATH = os.environ.get("TAX_INVOICE_DB", "tax_invoices.db")

# 상태: draft(임시저장) → issued(발급완료, 국세청 전송대기) → sent(국세청 전송완료) / failed(전송실패)
STATUSES = ("draft", "issued", "sent", "failed")

_local = threading.local()


def _conn() -> sqlite3.Connection:
    if getattr(_local, "conn", None) is None:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        _local.conn = conn
    return _local.conn


def init_db() -> None:
    conn = _conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS partners (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            corp_num   TEXT NOT NULL UNIQUE,
            data       TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS invoices (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            mgt_key         TEXT UNIQUE,
            status          TEXT NOT NULL DEFAULT 'draft',
            write_date      TEXT NOT NULL,
            tax_type        TEXT NOT NULL,
            purpose_type    TEXT NOT NULL,
            invoicer        TEXT NOT NULL,
            invoicee        TEXT NOT NULL,
            items           TEXT NOT NULL,
            supply_cost_total INTEGER NOT NULL,
            tax_total       INTEGER NOT NULL,
            total_amount    INTEGER NOT NULL,
            remark          TEXT DEFAULT '',
            nts_confirm_num TEXT DEFAULT '',
            nts_result      TEXT DEFAULT '',
            issued_at       TEXT DEFAULT '',
            created_at      TEXT NOT NULL,
            updated_at      TEXT NOT NULL
        );
        """
    )
    conn.commit()


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _row_to_invoice(row: sqlite3.Row) -> dict:
    d = dict(row)
    for key in ("invoicer", "invoicee", "items"):
        d[key] = json.loads(d[key])
    return d


# ── 설정(공급자 정보) ──────────────────────────────────────────────

def get_setting(key: str, default: dict | None = None) -> dict | None:
    row = _conn().execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def put_setting(key: str, value: dict) -> None:
    conn = _conn()
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, json.dumps(value, ensure_ascii=False)),
    )
    conn.commit()


# ── 거래처 ────────────────────────────────────────────────────────

def upsert_partner(corp_num: str, data: dict) -> None:
    conn = _conn()
    conn.execute(
        "INSERT INTO partners(corp_num, data, updated_at) VALUES(?, ?, ?) "
        "ON CONFLICT(corp_num) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        (corp_num, json.dumps(data, ensure_ascii=False), _now()),
    )
    conn.commit()


def list_partners() -> list[dict]:
    rows = _conn().execute("SELECT * FROM partners ORDER BY updated_at DESC").fetchall()
    return [{"id": r["id"], "corp_num": r["corp_num"], **json.loads(r["data"])} for r in rows]


def delete_partner(partner_id: int) -> bool:
    conn = _conn()
    cur = conn.execute("DELETE FROM partners WHERE id=?", (partner_id,))
    conn.commit()
    return cur.rowcount > 0


# ── 세금계산서 ────────────────────────────────────────────────────

def create_invoice(data: dict) -> dict:
    conn = _conn()
    now = _now()
    cur = conn.execute(
        """INSERT INTO invoices(status, write_date, tax_type, purpose_type, invoicer,
             invoicee, items, supply_cost_total, tax_total, total_amount, remark,
             created_at, updated_at)
           VALUES('draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            data["write_date"], data["tax_type"], data["purpose_type"],
            json.dumps(data["invoicer"], ensure_ascii=False),
            json.dumps(data["invoicee"], ensure_ascii=False),
            json.dumps(data["items"], ensure_ascii=False),
            data["supply_cost_total"], data["tax_total"], data["total_amount"],
            data.get("remark", ""), now, now,
        ),
    )
    invoice_id = cur.lastrowid
    # 문서번호(mgtKey): 사업자별 유일해야 하며 영문·숫자·'-'·'_' 24자 이내
    mgt_key = f"TI-{data['write_date']}-{invoice_id:06d}"
    conn.execute("UPDATE invoices SET mgt_key=? WHERE id=?", (mgt_key, invoice_id))
    conn.commit()
    return get_invoice(invoice_id)


def update_invoice(invoice_id: int, data: dict) -> dict | None:
    conn = _conn()
    cur = conn.execute(
        """UPDATE invoices SET write_date=?, tax_type=?, purpose_type=?, invoicer=?,
             invoicee=?, items=?, supply_cost_total=?, tax_total=?, total_amount=?,
             remark=?, updated_at=?
           WHERE id=? AND status='draft'""",
        (
            data["write_date"], data["tax_type"], data["purpose_type"],
            json.dumps(data["invoicer"], ensure_ascii=False),
            json.dumps(data["invoicee"], ensure_ascii=False),
            json.dumps(data["items"], ensure_ascii=False),
            data["supply_cost_total"], data["tax_total"], data["total_amount"],
            data.get("remark", ""), _now(), invoice_id,
        ),
    )
    conn.commit()
    return get_invoice(invoice_id) if cur.rowcount else None


def set_invoice_status(
    invoice_id: int,
    status: str,
    nts_confirm_num: str | None = None,
    nts_result: str | None = None,
    issued: bool = False,
) -> None:
    conn = _conn()
    sets, params = ["status=?", "updated_at=?"], [status, _now()]
    if nts_confirm_num is not None:
        sets.append("nts_confirm_num=?")
        params.append(nts_confirm_num)
    if nts_result is not None:
        sets.append("nts_result=?")
        params.append(nts_result)
    if issued:
        sets.append("issued_at=?")
        params.append(_now())
    params.append(invoice_id)
    conn.execute(f"UPDATE invoices SET {', '.join(sets)} WHERE id=?", params)
    conn.commit()


def get_invoice(invoice_id: int) -> dict | None:
    row = _conn().execute("SELECT * FROM invoices WHERE id=?", (invoice_id,)).fetchone()
    return _row_to_invoice(row) if row else None


def list_invoices(status: str | None = None) -> list[dict]:
    if status:
        rows = _conn().execute(
            "SELECT * FROM invoices WHERE status=? ORDER BY id DESC", (status,)
        ).fetchall()
    else:
        rows = _conn().execute("SELECT * FROM invoices ORDER BY id DESC").fetchall()
    return [_row_to_invoice(r) for r in rows]


def delete_invoice(invoice_id: int) -> bool:
    """임시저장 상태의 세금계산서만 삭제한다."""
    conn = _conn()
    cur = conn.execute("DELETE FROM invoices WHERE id=? AND status='draft'", (invoice_id,))
    conn.commit()
    return cur.rowcount > 0
