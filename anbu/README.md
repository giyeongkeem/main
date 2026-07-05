# 안부 (Anbu) — 웨어러블 시니어 케어 플랫폼

애플워치·핏빗 등 웨어러블의 걸음·심박·수면·움직임 데이터로
**"오늘도 평소와 같은가"** 를 확인해 주는 서비스.
하나의 감지 엔진 위에 두 개의 제품이 올라간다:

- **B2C 자녀 구독** — 지불자(자녀)와 사용자(부모)를 분리한 가족 구독 앱
- **B2G 지자체 위탁** — 독거노인 안부 관제 콘솔 (복지사 1인당 관리 인원 30 → 130명)

## 구성

```
anbu/
├── prototype 링크 → ../prototype/anbu.html   # UI 프로토타입 (자녀 앱 + 관제센터)
├── backend/
│   ├── anbu_api/
│   │   ├── detection.py    # 개인 베이스라인 대비 이상 감지 (순수 함수)
│   │   ├── alerts.py       # 대응 상태머신: 감지→AI전화→복지사→119
│   │   ├── db.py           # SQLite 저장 계층 (표준 라이브러리만)
│   │   └── main.py         # FastAPI — 인제스트/관제/보호자 API
│   ├── tests/              # 감지 규칙 + 상태머신 단위 테스트 (13개)
│   └── requirements.txt
├── scripts/simulate.py     # 12명 × 14일 시뮬레이션 → 전체 플로우 데모
└── ios/AnbuKit/            # HealthKit 백그라운드 수집 Swift 스켈레톤
```

## 감지 규칙 (전부 개인 베이스라인 대비 상대 판정)

| 신호 | 조건 | 심각도 | 첫 조치 |
|---|---|---|---|
| 무움직임 | 마지막 움직임 후 12시간+ (데이터는 수신 중) | 긴급 | 방문 출동 |
| 걸음 급감 | 3일 연속 베이스라인의 40% 미만 | 주의 | AI 안부전화 |
| 기상 지연 | 평소 기상 시각 +2시간 초과 미감지 | 주의 | AI 안부전화 |
| 야간 심박 | 3일 밤 연속 베이스라인 +15bpm | 주의 | AI 안부전화 |
| 무수신 | 48시간 데이터 없음 (미착용·미충전 추정) | 점검 | 생활지원사 방문 |

베이스라인은 직전 14일 중앙값, 표본 5일 미만이면 규칙을 스킵한다(신규 가입 오탐 방지).
진단이 아니라 "확인 권장"만 만든다 — 웰니스 범위로 의료기기 규제 밖.

## 실행

```bash
cd anbu/backend
pip install -r requirements.txt
python -m pytest tests/ -q            # 단위 테스트
python ../scripts/simulate.py         # 엔드투엔드 데모 (서버 불필요)
uvicorn anbu_api.main:app --reload    # API 서버 (http://localhost:8000/docs)
```

## API 요약

| 메서드 | 경로 | 용도 |
|---|---|---|
| POST | `/v1/seniors` | 대상자 등록 |
| POST | `/v1/seniors/{id}/ingest` | 워치/폰 샘플 배치 인제스트 |
| POST | `/v1/console/recompute` | 전체 감지 재실행 (운영에서는 스케줄러가 호출) |
| GET | `/v1/console/queue` | B2G 위험도순 대응 대기열 |
| GET | `/v1/console/kpis` | B2G 관제 KPI |
| POST | `/v1/alerts/{id}/action` | 상향(escalate) / 종결(resolve) |
| GET | `/v1/guardian/{id}/today` | B2C 자녀 앱 홈 데이터 |

모든 엔드포인트가 `?now=` 오버라이드를 받아 시뮬레이션·테스트가 결정적으로 돈다.

## 다음 단계 후보

1. 관제 콘솔 프로토타입(`prototype/anbu.html`)을 이 API에 연결
2. watchOS 익스텐션 — 낙상 감지(CMFallDetectionManager) + AI 안부전화 햅틱 응답
3. 인증/멀티테넌시(지자체별 분리), 알림 발송(FCM/카카오 알림톡)
4. 핏빗/삼성헬스 인제스트 어댑터 (동일 샘플 포맷으로 정규화)
