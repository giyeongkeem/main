"""알림 대응 상태머신 — 관제 프로토콜의 코드화.

  DETECTED ──▶ AI_CALL ──▶ WORKER ──▶ EMERGENCY(119)
     │            │           │            │
     └────────────┴───────────┴────────────┴──▶ RESOLVED

- '긴급' 신호(무움직임)는 AI 전화를 건너뛰고 바로 WORKER(방문)로 시작한다.
- '점검' 신호(무수신)는 기기 문제이므로 WORKER(생활지원사 방문)로 시작한다.
- RESOLVED/EMERGENCY 이후 재개는 불가 — 새 알림으로만 생성한다(감사 추적 목적).
"""

from __future__ import annotations

STATES = ("DETECTED", "AI_CALL", "WORKER", "EMERGENCY", "RESOLVED")
TERMINAL = frozenset({"RESOLVED"})

_ESCALATION = {
    "DETECTED": "AI_CALL",
    "AI_CALL": "WORKER",
    "WORKER": "EMERGENCY",
}

# 심각도별 시작 상태 — 프로토콜상 첫 조치가 다르다
INITIAL_STATE = {
    "긴급": "WORKER",     # 즉시 방문 출동
    "주의": "DETECTED",   # AI 안부전화부터
    "점검": "WORKER",     # 생활지원사 방문 (기기 점검)
}

ACTION_LABEL = {
    "DETECTED": "AI 안부전화",
    "AI_CALL": "복지사 확인",
    "WORKER": "방문 출동" ,
    "EMERGENCY": "119 이관됨",
    "RESOLVED": "종결",
}


class TransitionError(ValueError):
    pass


def initial_state(severity: str) -> str:
    try:
        return INITIAL_STATE[severity]
    except KeyError:
        raise TransitionError(f"알 수 없는 심각도: {severity}")


def escalate(state: str) -> str:
    """무응답/미해결 시 다음 단계로 상향."""
    if state in TERMINAL or state == "EMERGENCY":
        raise TransitionError(f"{state} 상태에서는 상향할 수 없습니다")
    return _ESCALATION[state]


def resolve(state: str) -> str:
    """어느 단계에서든 확인 완료로 종결 가능 (단, 이미 종결이면 오류)."""
    if state in TERMINAL:
        raise TransitionError("이미 종결된 알림입니다")
    return "RESOLVED"
