# 안부 (Anbu) — 웨어러블 시니어 케어 플랫폼

애플워치·핏빗 등 웨어러블의 걸음·심박·수면·움직임 데이터로
**"오늘도 평소와 같은가"** 를 확인해 주는 서비스.
하나의 감지 엔진 위에 두 개의 제품이 올라간다:

- **B2C 자녀 구독** — 지불자(자녀)와 사용자(부모)를 분리한 가족 구독 앱
- **B2G 지자체 위탁** — 독거노인 안부 관제 콘솔 (복지사 1인당 관리 인원 30 → 130명)

## 빠른 시작 (라이브 데모)

```bash
cd anbu/backend
pip install -r requirements.txt
uvicorn anbu_api.main:app --port 8000
# → http://localhost:8000  (관제센터 + 자녀 앱, 첫 접속 시 데모 데이터 자동 생성)
# → http://localhost:8000/docs  (OpenAPI 문서)
```

```bash
python -m pytest tests/ -q        # 단위·통합 테스트 25개
python ../scripts/simulate.py     # 터미널 엔드투엔드 데모 (서버 불필요)
docker build -t anbu . && docker run -p 8000:8000 -v anbu-data:/data anbu   # 운영 모드
```

## 구성

```
anbu/
├── backend/
│   ├── anbu_api/
│   │   ├── detection.py    # 개인 베이스라인 대비 이상 감지 (순수 함수)
│   │   ├── alerts.py       # 대응 상태머신: 감지→AI전화→복지사→119
│   │   ├── ingest.py       # 샘플 롤업: 원시 걸음·심박·수면 → 일 단위 지표
│   │   ├── adapters.py     # 핏빗/삼성헬스 페이로드 정규화
│   │   ├── auth.py         # 조직 API 키 · 디바이스 토큰 · 보호자 키
│   │   ├── db.py           # SQLite 저장 계층 (표준 라이브러리만)
│   │   ├── demo.py         # 데모 시드 (12명 × 14일, 시나리오 5종)
│   │   ├── main.py         # FastAPI — 전체 API + 라이브 대시보드 서빙
│   │   └── web/index.html  # 라이브 대시보드 (관제센터 + 자녀 앱)
│   ├── tests/              # 25개 테스트 (감지 규칙·상태머신·API 통합)
│   └── Dockerfile
├── scripts/simulate.py     # 터미널 엔드투엔드 데모
└── ios/
    ├── AnbuKit/            # iPhone: HealthKit 백그라운드 수집 + 배치 업로더
    └── AnbuWatch/          # watchOS: 낙상 감지(CMFallDetection) + 안부 응답 UI
```

`prototype/anbu.html`(리포 루트)은 초기 UI 컨셉 프로토타입으로 남겨 두었다 —
정적 시뮬레이션 데이터 버전. 라이브 버전은 `backend/anbu_api/web/`이다.

## 감지 규칙 (전부 개인 베이스라인 대비 상대 판정)

| 신호 | 조건 | 심각도 | 첫 조치 |
|---|---|---|---|
| 낙상 | 워치 CMFallDetection 이벤트 | 긴급 | 방문 출동 |
| 무움직임 | 마지막 움직임 후 12시간+ (데이터는 수신 중) | 긴급 | 방문 출동 |
| 걸음 급감 | 3일 연속 베이스라인의 40% 미만 | 주의 | AI 안부전화 |
| 기상 지연 | 평소 기상 시각 +2시간 초과 미감지 | 주의 | AI 안부전화 |
| 야간 심박 | 3일 밤 연속 베이스라인 +15bpm | 주의 | AI 안부전화 |
| 무수신 | 48시간 데이터 없음 (미착용·미충전 추정) | 점검 | 생활지원사 방문 |

베이스라인은 직전 14일 중앙값, 표본 5일 미만이면 규칙을 스킵한다(신규 가입 오탐 방지).
진단이 아니라 "확인 권장"만 만든다 — 웰니스 범위로 의료기기 규제 밖.

## 인증 · 멀티테넌시

| 자격 증명 | 헤더 | 범위 |
|---|---|---|
| 조직 API 키 | `X-API-Key` | 관제 콘솔·등록·벤더 웹훅 (테넌트 스코프) |
| 디바이스 토큰 | `Authorization: Bearer` | 본인 인제스트·낙상 보고·본인 알림 응답 |
| 보호자 키 | `X-Guardian-Key` | 해당 어르신 자녀 앱 조회 |

지자체(구)마다 조직을 발급받아 데이터가 완전히 분리된다. B2C는 `anbu-b2c` 같은
서비스 조직 하나로 운영한다. 기본값은 데모 모드(인증 생략, `demo` 조직)이고,
`ANBU_REQUIRE_AUTH=1`(Dockerfile 기본)이면 전 엔드포인트에 인증을 강제한다.

## 데이터 인입 경로 3가지

1. **애플워치/아이폰** — `ios/AnbuKit`이 HealthKit에서 증분 수집해
   `POST /v1/seniors/{id}/ingest`로 배치 업로드 (원시 샘플, 서버가 롤업)
2. **핏빗·삼성헬스** — 서버-투-서버 `POST /v1/adapters/{fitbit|samsung}/{id}`,
   `adapters.py`가 표준 샘플로 정규화 (신규 벤더 = normalize 함수 하나 추가)
3. **낙상** — watchOS가 `POST /v1/seniors/{id}/fall`로 즉시 보고 (인제스트 우회)

## API 요약

| 메서드 | 경로 | 인증 | 용도 |
|---|---|---|---|
| POST | `/v1/orgs` | (어드민) | 테넌트 발급 |
| POST | `/v1/seniors` | 조직 키 | 대상자 등록 → 디바이스 토큰·보호자 키 발급 |
| POST | `/v1/seniors/{id}/ingest` | 디바이스 | 샘플 배치 (집계값+원시값) |
| POST | `/v1/seniors/{id}/fall` | 디바이스 | 낙상 즉시 보고 |
| POST | `/v1/adapters/{vendor}/{id}` | 조직 키 | 핏빗/삼성헬스 웹훅 |
| POST | `/v1/console/recompute` | 조직 키 | 감지 재실행 (운영: 스케줄러 10분 주기) |
| GET | `/v1/console/queue` | 조직 키 | 위험도순 대응 대기열 |
| GET | `/v1/console/kpis` | 조직 키 | 관제 KPI |
| POST | `/v1/alerts/{id}/action` | 조직 키 또는 디바이스 | 상향/종결 (워치 '괜찮아요' 포함) |
| GET | `/v1/guardian/{id}/today` | 보호자 키 | 자녀 앱 홈 |
| POST | `/v1/demo/seed` | 조직 키 | 데모 데이터 재생성 |

모든 엔드포인트가 `?now=` 오버라이드를 받아 시뮬레이션·테스트가 결정적으로 돈다.

## 남은 프로덕션 갭 (정직한 목록)

- AI 안부전화 실제 발신(TTS/전화망) — 현재는 상태머신 단계로만 존재
- 푸시 알림(APNs/FCM/알림톡) 발송 채널
- 스케줄러(recompute 주기 실행)와 SQLite → PostgreSQL 전환
- 핏빗/삼성 OAuth 토큰 교환 플로우 (어댑터는 페이로드 정규화까지 구현됨)
- watchOS 낙상 entitlement는 Apple 심사 필요
