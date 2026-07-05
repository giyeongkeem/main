from datetime import date, datetime, timedelta

from anbu_api.detection import DayRecord, evaluate

NOW = datetime(2026, 7, 5, 9, 40)


def normal_days(n=14, steps=3800, wake=390, hr=62):
    start = NOW.date() - timedelta(days=n)
    return [DayRecord(day=start + timedelta(days=i), steps=steps + (i % 3) * 50,
                      wake_time=wake + (i % 2) * 10, night_hr=hr + (i % 2))
            for i in range(n)]


def kinds(signals):
    return [s.kind for s in signals]


def test_all_normal_produces_no_signals():
    days = normal_days() + [DayRecord(day=NOW.date(), steps=1200, wake_time=395)]
    sigs = evaluate(days, last_motion=NOW - timedelta(minutes=30), last_ingest=NOW, now=NOW)
    assert sigs == []


def test_no_data_short_circuits_everything():
    sigs = evaluate(normal_days(), last_motion=NOW - timedelta(hours=60),
                    last_ingest=NOW - timedelta(hours=52), now=NOW)
    assert kinds(sigs) == ["no_data"]
    assert sigs[0].severity == "점검"


def test_no_motion_is_emergency_and_sorted_first():
    days = normal_days()
    # 걸음 급감도 함께 유발 → 긴급이 맨 앞에 와야 한다
    for i in range(1, 4):
        days[-i] = DayRecord(day=days[-i].day, steps=500, wake_time=390, night_hr=62)
    sigs = evaluate(days, last_motion=NOW - timedelta(hours=18), last_ingest=NOW, now=NOW)
    assert kinds(sigs)[0] == "no_motion"
    assert sigs[0].severity == "긴급"
    assert "steps_drop" in kinds(sigs)


def test_steps_drop_requires_consecutive_days():
    days = normal_days()
    # 이틀만 급감 → 신호 없음
    for i in range(1, 3):
        days[-i] = DayRecord(day=days[-i].day, steps=500, wake_time=390, night_hr=62)
    sigs = evaluate(days, last_motion=NOW - timedelta(hours=1), last_ingest=NOW, now=NOW)
    assert "steps_drop" not in kinds(sigs)


def test_late_wake_when_today_missing():
    days = normal_days()  # 평소 06:30±10 기상, 지금 09:40인데 오늘 기상 기록 없음
    sigs = evaluate(days, last_motion=NOW - timedelta(hours=1), last_ingest=NOW, now=NOW)
    assert "late_wake" in kinds(sigs)


def test_night_hr_needs_three_consecutive_nights():
    days = normal_days()
    for i in range(1, 4):
        days[-i] = DayRecord(day=days[-i].day, steps=3800, wake_time=390, night_hr=80)
    sigs = evaluate(days, last_motion=NOW - timedelta(hours=1), last_ingest=NOW, now=NOW)
    assert "night_hr" in kinds(sigs)

    days[-2] = DayRecord(day=days[-2].day, steps=3800, wake_time=390, night_hr=63)  # 하루 정상
    sigs = evaluate(days, last_motion=NOW - timedelta(hours=1), last_ingest=NOW, now=NOW)
    assert "night_hr" not in kinds(sigs)


def test_insufficient_baseline_skips_rules():
    days = normal_days(3)  # 표본 3일 — 베이스라인 미성립
    sigs = evaluate(days, last_motion=NOW - timedelta(hours=1), last_ingest=NOW, now=NOW)
    assert sigs == []
