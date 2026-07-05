# 내 애플워치로 안부 테스트하기

Xcode·개발자 계정 없이, 지금 차고 있는 애플워치 + 아이폰만으로
전체 파이프라인(수집 → 감지 → 대시보드)을 본인 데이터로 돌려보는 가이드.

핵심 아이디어: 아이폰의 **Health Auto Export** 앱(앱스토어)이 애플 건강
데이터를 JSON으로 우리 서버에 POST해 준다. 서버에는 이 형식 전용 어댑터
(`/v1/adapters/health-auto-export/...`)가 이미 구현되어 있다.

---

## 1단계 — 서버 띄우기 (둘 중 하나)

### 방법 A. Render 무료 배포 (아이폰이 어디서든 접근 가능 · 권장)

1. 이 리포를 GitHub에 푸시한 상태에서 [render.com](https://render.com) →
   **New + → Blueprint** → 이 저장소 선택. `render.yaml`의 `anbu-api` 서비스가
   자동 생성된다.
2. 배포 후 **Environment 탭 → `ANBU_SETUP_CODE`** 에 임의의 비밀 문자열 입력
   (예: `my-secret-42`). 저장하면 재배포된다.
3. 서비스 URL 확인 (예: `https://anbu-api.onrender.com`).

> 무료 플랜 특성: 15분 무트래픽 시 잠들었다가 첫 요청에 깨어나고(수십 초),
> 재배포 시 데이터가 초기화된다. 개인 테스트에는 충분하다.

### 방법 B. 집 PC에서 로컬 실행 (아이폰과 같은 와이파이)

```bash
cd anbu/backend
pip install -r requirements.txt
uvicorn anbu_api.main:app --host 0.0.0.0 --port 8000
```

PC의 내부 IP를 확인하고(`ipconfig`/`ifconfig`, 예: 192.168.0.10),
아이폰에서 `http://192.168.0.10:8000` 으로 접근한다.
로컬은 데모 모드라 `ANBU_SETUP_CODE` 없이 바로 다음 단계로 간다.

---

## 2단계 — 본인 등록 (1회, 터미널에서)

```bash
# Render 배포 기준. 로컬이면 host를 바꾸고 ?code= 는 생략.
curl -X POST "https://anbu-api.onrender.com/v1/personal/register?code=my-secret-42" \
  -H "Content-Type: application/json" \
  -d '{"name": "기영", "age": 30}'
```

응답에 필요한 것이 전부 들어 있다 — **이 응답을 저장해 두자**:

```json
{
  "hae_url": "https://.../v1/adapters/health-auto-export/me?token=dev_...",
  "guardian_dashboard": "https://.../app/?view=guardian&senior=me&gkey=gk_...",
  "console_dashboard": "https://.../app/?org_key=anbu_...",
  ...
}
```

## 3단계 — 아이폰에서 Health Auto Export 설정

1. 앱스토어에서 **"Health Auto Export — JSON+CSV"** 설치, 건강 데이터 접근 허용.
2. 첫 테스트는 수동 내보내기로 (무료):
   - 앱에서 **Export → REST API** 형식 선택
   - URL에 2단계 응답의 **`hae_url`** 붙여넣기
   - 지표 선택: **Steps, Heart Rate, Resting Heart Rate, Sleep Analysis**
   - 기간: **최근 14일** (베이스라인이 바로 성립하도록)
   - Aggregation: Days 권장 → **Export** 실행
3. 자동 동기화까지 원하면(프리미엄 구독 기능): **Automations → 새 자동화 →
   REST API** 에 같은 URL, 주기 1시간으로 설정.

> 서버 응답에 `{"ok": true, "normalized": N, ...}` 가 보이면 성공.
> 같은 기간을 다시 보내도 걸음 수가 중복 합산되지 않도록 설계돼 있으니
> 마음껏 재전송해도 된다.

## 4단계 — 대시보드에서 내 데이터 보기

- **자녀 앱 뷰**: 2단계의 `guardian_dashboard` URL을 아이폰/PC 브라우저에서 열기.
  내 실제 기상 시각·걸음·심박으로 "오늘도 평소와 같아요"가 렌더링된다.
- **관제 콘솔**: `console_dashboard` URL — 나 혼자만 있는 관제센터. 15초마다
  감지가 자동으로 돌아 신호가 생기면 대기열에 올라온다.

## 5단계 — 이상 신호를 일부러 만들어 보기

베이스라인은 최근 14일 중앙값이므로, 14일치를 넣었다면 바로 실험 가능:

| 실험 | 방법 | 기대 결과 |
|---|---|---|
| 기상 지연 | 평소 기상 +2시간이 지나도록 오늘 수면 데이터를 안 보냄 | 주의 — "평소 HH:MM 기상 → 오늘 미감지" |
| 걸음 급감 | HAE에서 최근 3일 걸음만 빼고 내보내기 (또는 3일 집에만 있기) | 주의 — 걸음 3일 연속 급감 |
| 무수신 | 48시간 동안 아무것도 안 보냄 | 점검 — 미착용/미충전 추정 |
| 낙상 | `curl -X POST ".../v1/seniors/me/fall" -H "Authorization: Bearer <device_token>" -d '{"ts":"...","confirmed":true}'` | 긴급 — 방문 출동 대기열 |

관제 콘솔에서 조치 버튼(완료/상향)을 눌러 상태머신이 도는 것까지 확인하면
전체 플로우를 본인 데이터로 검증한 것이다.

## 문제 해결

- **HAE 전송이 401** → URL의 `?token=` 이 등록 응답의 `device_token`과 다름.
  재등록하면 기존 토큰이 유지된 채 응답에 다시 나온다.
- **대시보드가 401** → URL 파라미터(`gkey`, `org_key`)가 빠졌는지 확인.
- **신호가 안 뜸** → 데이터가 5일 미만이면 베이스라인 미성립으로 규칙이
  침묵한다(설계 의도). 14일치 내보내기로 해결.
- **Render가 응답 없음** → 무료 플랜이 잠든 것. 첫 요청 후 30초쯤 기다렸다 재시도.
- **시간이 9시간 어긋남** → `ANBU_TZ_OFFSET_HOURS=9` 환경변수 확인 (Render 기본 설정됨).
