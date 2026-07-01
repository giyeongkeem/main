# 핏매치 (FitMatch) — 서울 피트니스·필라테스 전문가 비교 서비스

서울의 **피트니스 센터 · 퍼스널 트레이너 · 필라테스 트레이너 · 필라테스 센터**를
**자격증 보유 여부, 실제 이용 후기, 시설 사진, 가격**으로 한눈에 비교하고
소비자가 직접 선택할 수 있는 디렉터리 웹 서비스입니다.

> ⚠️ 데모 프로젝트입니다. 등록된 트레이너·센터·후기·자격증 정보는 모두 **샘플 데이터**이며 실제 인물·업체와 무관합니다.

## ✨ 주요 기능

- **카테고리별 탐색** — 피트니스 / 퍼스널 트레이너 / 필라테스 트레이너 / 필라테스 센터
- **자격증 검증 배지** — 생활스포츠지도사, 건강운동관리사, NSCA, NASM, STOTT, BASI, Polestar 등 발급기관과 대조한 ‘인증’ 표시
- **상세 필터링** — 지역(자치구), 가격 정렬, 최소 평점, 자격증 인증 여부, 트레이너 성별, 전문 분야
- **검색** — 이름·지역·전문 분야·자격증 통합 검색
- **시설 사진 갤러리** — 운동 공간·기구·탈의실 등 방문 전 미리 확인
- **이용 후기** — 별점 분포 + 항목별 태그가 있는 상세 후기
- **비교함** — 최대 3곳을 가격·평점·경력·자격증·시설 기준으로 나란히 비교 (로컬 저장)
- **후기 작성** — 방문자가 별점·후기를 남기면 평점이 자동 반영, 관리자 후기 삭제 가능
- **업체 셀프 등록** — `/register`에서 신청 → 관리자 **승인/반려** 후 공개
- **소셜 로그인** — 카카오·네이버·애플 로그인(Auth.js), 로그인 시 후기를 내 이름으로 작성
- **이미지 저장** — 로컬(`public/uploads`) 또는 **Supabase Storage** 자동 전환
- **반응형 UI** — 데스크톱/모바일 모두 지원, 모바일 필터 드로어 제공

## 🗂 페이지 구성

| 경로 | 설명 |
| --- | --- |
| `/` | 홈 — 히어로 검색, 카테고리, 추천 전문가, 신뢰 지표 |
| `/listings` | 전체 디렉터리 — 필터·정렬·검색 |
| `/listings/[id]` | 상세 — 갤러리, 자격증, 전문 분야, 시설, 후기, 비교 담기 |
| `/compare` | 비교함 — 담은 전문가 항목별 비교 |

## 🛠 기술 스택

- **Next.js 15** (App Router) · **React 18** · **TypeScript**
- **Tailwind CSS 3**
- 외부 DB·API 없이 동작하는 시드 데이터(`lib/data.ts`)
- 네트워크 의존 없는 자체 생성 시설 이미지(`components/FacilityImage.tsx`)

## 🚀 실행 방법

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 (http://localhost:3000)

npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 서버 실행
```

## 🔐 관리자(어드민) 사용법

관리자가 직접 전문가·센터 정보를 등록/수정/삭제하고 **시설 사진을 업로드**할 수 있습니다.

1. 사이트 실행 후 **`/admin`** 접속 → 로그인 화면으로 이동
2. 기본 비밀번호 **`admin1234`** 입력 (운영 시 반드시 변경)
3. 관리자 콘솔에서:
   - **+ 새 전문가 등록** — 기본 정보·가격·전문 분야·자격증·사진 입력
   - 각 행의 **수정 / 삭제**
   - 자격증의 **‘인증’ 체크** → 사이트에 ✓인증 배지로 노출
   - 사진 **업로드**(jpg/png/webp) 또는 미업로드 시 색상 플레이스홀더 표시

비밀번호 변경(환경변수):

```bash
# .env.local (예시)
ADMIN_PASSWORD="원하는비밀번호"
ADMIN_SECRET="아무_긴_임의문자열"
```

## 🗄 저장소 동작 방식 (자동 전환)

데이터 접근은 `lib/store.ts` 한 곳에 모여 있고, **환경변수에 따라 백엔드가 자동 전환**됩니다.

| 조건 | 백엔드 | 용도 |
| --- | --- | --- |
| `DATABASE_URL` 없음 | 로컬 JSON 파일(`data/listings.json`) | 로컬 개발 (설정 불필요) |
| `DATABASE_URL` 설정됨 | PostgreSQL | 배포 / 영구 저장 |

테이블·시드는 첫 실행 시 **자동 생성**됩니다. (관리자 콘솔 상단에 현재 저장소가 표시됩니다.)

## 🌐 배포하기 (Supabase + Vercel)

로컬 파일 저장은 배포 환경(서버리스)에서 쓰기가 제한되므로, 배포 시에는 Postgres(Supabase)를 연결합니다.

1. **Supabase** — [supabase.com](https://supabase.com)에서 프로젝트 생성 →
   *Project Settings → Database → Connection string (URI)* 복사
2. **Vercel** — [vercel.com](https://vercel.com)에서 GitHub 저장소 `import` (Next.js 자동 인식)
3. Vercel **Environment Variables**에 추가:
   - `DATABASE_URL` = 위 Supabase 연결 문자열
   - `ADMIN_PASSWORD` = 원하는 관리자 비밀번호
   - `ADMIN_SECRET` = 임의의 긴 문자열
   - `AUTH_SECRET` = 임의의 긴 문자열 (`openssl rand -base64 32`)
   - (이미지) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — *Settings → API*
   - (소셜 로그인) 아래 “소셜 로그인 설정”의 키들
4. **Deploy** → 첫 접속 시 DB 테이블·시드, Storage 버킷이 자동 생성됩니다.

### 🖼 이미지 저장 (Supabase Storage)
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 를 설정하면 업로드 이미지가 **Supabase Storage**(public 버킷 `uploads`)에
저장됩니다. 버킷은 첫 업로드 시 자동 생성됩니다. 미설정 시 로컬 `data/uploads`(`/api/uploads`로 서빙)를 사용합니다.

### 🔑 소셜 로그인 설정 (카카오 · 네이버 · 애플)
환경변수가 있는 제공자만 로그인 버튼이 활성화됩니다. 공통으로 `AUTH_SECRET` 이 필요합니다.
각 제공자 콘솔에 **Redirect/Callback URL** 을 등록하세요 (`https://<도메인>/api/auth/callback/<provider>`).

| 제공자 | 콘솔 | 환경변수 | 콜백 URL |
| --- | --- | --- | --- |
| 카카오 | developers.kakao.com | `AUTH_KAKAO_ID`, `AUTH_KAKAO_SECRET` | `/api/auth/callback/kakao` |
| 네이버 | developers.naver.com | `AUTH_NAVER_ID`, `AUTH_NAVER_SECRET` | `/api/auth/callback/naver` |
| 애플 | developer.apple.com (유료) | `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET` | `/api/auth/callback/apple` |

애플은 `AUTH_APPLE_ID`=Services ID, `AUTH_APPLE_SECRET`=`.p8` 키로 만든 JWT입니다. 아래로 생성:

```bash
APPLE_TEAM_ID=XXXX APPLE_KEY_ID=YYYY APPLE_CLIENT_ID=com.your.serviceid \
APPLE_P8_PATH=./AuthKey_YYYY.p8 node scripts/generate-apple-secret.mjs
```

## 📁 프로젝트 구조

```
app/
  layout.tsx              # 공통 레이아웃 (헤더·푸터·비교 컨텍스트)
  page.tsx                # 홈
  listings/page.tsx       # 디렉터리 (필터)
  listings/[id]/page.tsx  # 상세
  compare/page.tsx        # 비교함
  login/                  # 소셜 로그인 (카카오·네이버·애플)
  register/               # 업체·전문가 셀프 등록 신청
  admin/                  # 관리자 콘솔 (로그인·대시보드·등록·수정·승인)
  api/                    # listings·reviews·submit + auth + 관리자 CRUD/업로드 API
components/               # UI 컴포넌트 (카드·갤러리·필터·후기폼·소셜로그인 등)
  admin/                  # 관리자 폼·액션 컴포넌트
lib/
  data.ts                 # 시드 데이터 + 상수/헬퍼
  store.ts                # 데이터 접근 계층 (JSON/Postgres 자동 선택)
  db-json.ts / db-postgres.ts  # 저장 백엔드
  storage.ts              # 이미지 저장 (로컬/Supabase Storage 자동 선택)
  auth.ts                 # 소셜 로그인(Auth.js) 설정
  admin-auth.ts           # 관리자 인증
  types.ts                # 타입 정의
scripts/
  generate-apple-secret.mjs    # Apple 로그인용 client secret(JWT) 생성
```

## 🔧 실제 서비스로 확장하려면

- `lib/data.ts`의 시드 데이터를 실제 DB(예: PostgreSQL + Prisma)로 교체
- `components/FacilityImage.tsx`를 실제 업로드 이미지(`next/image`)로 교체
- 자격증 인증 워크플로(서류 제출·기관 대조), 예약·결제, 트레이너 가입/관리 기능 추가
- 후기 작성·신고, 지도(위치 기반 검색) 연동
