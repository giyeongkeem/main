"""인증·멀티테넌시.

세 종류의 자격 증명:
- 조직 API 키 (X-API-Key)      → 관제 콘솔·대상자 등록·벤더 웹훅. 테넌트 스코프.
- 디바이스 토큰 (Bearer)        → 해당 대상자의 인제스트만 가능.
- 보호자 키 (X-Guardian-Key)    → 해당 대상자의 자녀 앱 조회만 가능.

데모 모드(기본): ANBU_REQUIRE_AUTH=1 이 아니면 자격 증명 없는 요청을
'demo' 조직으로 통과시킨다 — 로컬 데모와 프로토타입 연결용.
"""

from __future__ import annotations

import os
import sqlite3
from typing import Optional

from fastapi import Header, HTTPException

from . import db as store


def _auth_required() -> bool:
    return os.environ.get("ANBU_REQUIRE_AUTH") == "1"


def require_org(conn: sqlite3.Connection, x_api_key: Optional[str]) -> sqlite3.Row:
    if x_api_key:
        org = store.org_by_key(conn, x_api_key)
        if org is None:
            raise HTTPException(401, "잘못된 API 키")
        return org
    if _auth_required():
        raise HTTPException(401, "X-API-Key 헤더가 필요합니다")
    return store.org_by_key(conn, store.DEMO_ORG[2])


def require_device(conn: sqlite3.Connection, sid: str, authorization: Optional[str]) -> sqlite3.Row:
    senior = conn.execute("SELECT * FROM seniors WHERE id=?", (sid,)).fetchone()
    if senior is None:
        raise HTTPException(404, "등록되지 않은 대상자")
    if authorization and authorization.startswith("Bearer "):
        if authorization.removeprefix("Bearer ") != senior["device_token"]:
            raise HTTPException(401, "디바이스 토큰 불일치")
        return senior
    if _auth_required():
        raise HTTPException(401, "Authorization: Bearer <device_token> 이 필요합니다")
    return senior


def require_guardian(conn: sqlite3.Connection, sid: str, x_guardian_key: Optional[str]) -> sqlite3.Row:
    senior = conn.execute("SELECT * FROM seniors WHERE id=?", (sid,)).fetchone()
    if senior is None:
        raise HTTPException(404, "등록되지 않은 대상자")
    if x_guardian_key:
        if x_guardian_key != senior["guardian_key"]:
            raise HTTPException(401, "보호자 키 불일치")
        return senior
    if _auth_required():
        raise HTTPException(401, "X-Guardian-Key 헤더가 필요합니다")
    return senior
