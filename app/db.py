import json
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Optional

from . import config

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
);
"""

TERMINAL_STATUSES = ("completed", "failed")


def init(db_path=None) -> None:
    global _conn
    _conn = sqlite3.connect(str(db_path or config.DB_PATH), check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    # WAL lets dashboard reads proceed without blocking the worker's writes.
    _conn.execute("PRAGMA journal_mode=WAL")
    with _lock:
        _conn.execute(SCHEMA)
        _conn.commit()


def fail_stale_jobs(message: str) -> int:
    """Mark any non-terminal job as failed. Called at startup: the in-memory
    queue does not survive a restart, so rows left mid-flight would otherwise
    show 'in progress' forever."""
    with _lock:
        cur = _conn.execute(
            "UPDATE jobs SET status = 'failed', error = ? "
            "WHERE status NOT IN ('completed', 'failed')",
            (message,),
        )
        _conn.commit()
        return cur.rowcount


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["metadata"] = json.loads(d["metadata"]) if d["metadata"] else None
    return d


def create_job(job_id: str, topic: str, language: str) -> dict:
    created_at = datetime.now(timezone.utc).isoformat()
    with _lock:
        _conn.execute(
            "INSERT INTO jobs (id, topic, language, created_at) VALUES (?, ?, ?, ?)",
            (job_id, topic, language, created_at),
        )
        _conn.commit()
    return get_job(job_id)


def get_job(job_id: str) -> Optional[dict]:
    with _lock:
        row = _conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    return _row_to_dict(row) if row else None


def list_jobs() -> list[dict]:
    with _lock:
        rows = _conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
    return [_row_to_dict(r) for r in rows]


def update_job(
    job_id: str,
    status: Optional[str] = None,
    progress: Optional[int] = None,
    error: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    sets, vals = [], []
    if status is not None:
        sets.append("status = ?")
        vals.append(status)
    if progress is not None:
        sets.append("progress = ?")
        vals.append(progress)
    if error is not None:
        sets.append("error = ?")
        vals.append(error)
    if metadata is not None:
        sets.append("metadata = ?")
        vals.append(json.dumps(metadata, ensure_ascii=False))
    if not sets:
        return
    vals.append(job_id)
    with _lock:
        _conn.execute(f"UPDATE jobs SET {', '.join(sets)} WHERE id = ?", vals)
        _conn.commit()


def delete_job(job_id: str) -> None:
    with _lock:
        _conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        _conn.commit()
