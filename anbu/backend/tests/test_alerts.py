import pytest

from anbu_api import alerts as sm


def test_warning_starts_with_ai_call_path():
    s = sm.initial_state("주의")
    assert s == "DETECTED"
    s = sm.escalate(s)
    assert s == "AI_CALL"
    s = sm.escalate(s)
    assert s == "WORKER"
    s = sm.escalate(s)
    assert s == "EMERGENCY"


def test_emergency_skips_ai_call():
    assert sm.initial_state("긴급") == "WORKER"


def test_device_check_goes_to_worker():
    assert sm.initial_state("점검") == "WORKER"


def test_resolve_from_any_active_state():
    for state in ("DETECTED", "AI_CALL", "WORKER", "EMERGENCY"):
        assert sm.resolve(state) == "RESOLVED"


def test_terminal_states_are_final():
    with pytest.raises(sm.TransitionError):
        sm.resolve("RESOLVED")
    with pytest.raises(sm.TransitionError):
        sm.escalate("RESOLVED")
    with pytest.raises(sm.TransitionError):
        sm.escalate("EMERGENCY")  # 119 이관 후엔 종결만 가능


def test_unknown_severity_rejected():
    with pytest.raises(sm.TransitionError):
        sm.initial_state("무엇")
