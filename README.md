# 🗞️ Card News Studio

인스타그램 **카드뉴스**를 혼자서 처음부터 끝까지 만드는 웹 도구입니다.
주제만 정하면 → 최신 뉴스 수집·요약 → 카드뉴스 글 작성 → 디자인 카드 → 업로드용 PNG 패키징까지 한 흐름으로 이어집니다.

## 워크플로 (요청한 6단계 매핑)

| 단계 | 화면 | 설명 |
| --- | --- | --- |
| 1. 주제 선정 | **주제 선정** | 키워드·관점·톤·핸들 입력 |
| 2. 뉴스 크롤링 & 요약 | **뉴스·요약** | Google News + RSS 피드에서 최신 기사 수집 → 선택 → AI 요약 |
| 3. 아티클 작성 | **아티클** | 요약을 바탕으로 표지·본문·마무리 카드 문구 자동 작성 |
| 4. 이미지 제작 | **디자인·편집** | HTML/CSS 템플릿으로 카드 슬라이드 렌더링 (WYSIWYG 미리보기). 카드별 이미지 업로드/URL 추가 |
| 5. 출력 & 패키징 | **내보내기** | 1080px 고해상도 PNG + ZIP 다운로드, 캡션 복사 |
| 6. 수정 기능 | **디자인·편집** | **텍스트·이미지·색상·템플릿·정렬·순서·카드 추가/삭제**를 실시간 편집. 어느 단계든 자유롭게 되돌아가 수정 |

## 핵심 특징

- **AI 모델 전환** — Claude(Anthropic) / OpenAI(GPT)를 설정에서 선택. 요약·작성에 사용.
- **RSS 기반 뉴스 수집** — 키워드로 Google News RSS를 검색하고, 등록한 언론사 RSS를 합쳐 필터링. (API 키 불필요)
- **클릭해서 바로 수정** — 미리보기 카드의 제목·본문·라벨을 **직접 클릭해 그 자리에서 타이핑**으로 수정. 이미지를 클릭하면 이미지 설정으로 이동.
- **텍스트 + 이미지 편집** — 카드마다 문구·정렬(좌/가운데)을 수정하고, 이미지를 업로드하거나 URL로 넣어 **배경/상단** 배치·어둡기(스크림)를 조절.
- **폰트 선택** — 제목/본문 폰트를 따로 선택 (Pretendard 기본, 노토산스·고딕A1·나눔고딕·노토세리프·나눔명조·블랙한산스·도현·고운돋움 등 9종).
- **WYSIWYG 카드** — 미리보기와 내보낸 PNG가 동일한 HTML/CSS에서 나옵니다 (Playwright로 캡처). 프록시 환경에서도 폰트가 정확히 렌더되도록 서버가 폰트 요청을 중계.
- **로컬 우선** — 모든 작업 상태는 브라우저(localStorage)에 자동 저장됩니다. 혼자 쓰는 용도에 최적화.
- **API 키 없이도 체험** — 키가 없으면 요약·작성 단계가 데모 데이터로 동작합니다.

## 시작하기

```bash
# 1) 의존성 설치
npm install

# 2) (최초 1회) 카드 렌더링용 헤드리스 브라우저 설치
npx playwright install chromium

# 3) (선택) API 키 설정 — 또는 앱의 설정(⚙️) 화면에서 입력해도 됩니다
cp .env.local.example .env.local
#   .env.local 에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 입력

# 4) 개발 서버
npm run dev
# http://localhost:3000
```

### API 키 입력 방법 2가지
1. **설정(⚙️) 화면** — 키를 입력하면 이 브라우저에만 저장되고 요청 시 전송됩니다. (가장 간편)
2. **환경 변수** — `.env.local` 에 넣고 설정 화면의 키 칸은 비워 두면 서버에서만 사용됩니다. (더 안전)

## 기술 스택

- **Next.js 14** (App Router) · TypeScript · Tailwind CSS
- **rss-parser** — 뉴스 수집 / **cheerio** — 본문 추출
- **Claude / OpenAI REST API** — 요약·작성
- **Playwright (Chromium)** — 카드 HTML → PNG / **JSZip** — 패키징
- **zustand** — 상태 관리 + localStorage 영속화

## 프로젝트 구조

```
app/
  page.tsx              5단계 워크플로 오케스트레이터
  api/
    news/               RSS·Google News 검색
    extract/            기사 본문 추출 (best-effort)
    summarize/          AI 요약
    article/            카드뉴스 아티클 생성 (JSON)
    render/             Playwright로 PNG 렌더 + ZIP
lib/
  cardTemplate.ts       카드 HTML 단일 소스 (미리보기 = 내보내기)
  llm.ts / prompts.ts   모델 추상화 + 프롬프트
  news.ts / extract.ts  뉴스 수집·추출
  render.ts             헤드리스 렌더 + 패키징
  presets.ts / types.ts 팔레트·사이즈·피드, 타입
components/             Stepper · 단계별 패널 · CardPreview · Settings
store/useProject.ts     프로젝트 상태(zustand)
```

## 참고

- Google News RSS 링크는 리다이렉트를 거칩니다. 본문 추출이 막히면 기사 제목·스니펫만으로 요약합니다.
- 기본 RSS 피드 목록은 설정에서 자유롭게 추가/삭제할 수 있습니다. (언론사 피드 주소는 바뀔 수 있어요)
- 배포(예: Vercel) 시에는 Playwright 렌더가 별도 설정이 필요할 수 있습니다. 로컬 실행을 권장합니다.
