# 섹터 뉴스 리포트 에이전트

국내·해외 관심 주식 섹터의 주요 이슈를 실시간 웹 검색으로 수집하고, 투자 관점에서 정리한 데일리 리포트(Markdown)를 생성하는 에이전트입니다.

Claude API의 서버사이드 웹 검색/페치 도구를 사용하므로 별도의 뉴스 API 키 없이 동작합니다.

## 📊 소셜미디어 트렌드 대시보드

국내/해외의 **YouTube 인기 급상승 · TikTok 인기 해시태그 · Google 실시간 검색 트렌드 · Instagram 트렌드 소식**을 한 화면에서 종합적으로 보는 별도 웹서비스입니다. API 키 없이 동작합니다.

```bash
pip install -r requirements.txt
python -m trend_dashboard        # http://localhost:8100
```

- **국내 🇰🇷 / 해외 🌍 탭**으로 지역을 전환합니다.
- **영상·사진 중심 UI**: YouTube는 썸네일 그리드, TikTok은 세로 커버 그리드로 표시되고, **타일을 클릭하면 페이지 안에서 바로 재생**됩니다(임베드 플레이어, ESC로 닫기). Google 트렌드·Instagram 소식에도 관련 이미지가 붙습니다.
- 상단 **크로스 플랫폼 핫 키워드**: 여러 플랫폼에서 동시에 등장하는 키워드를 추려 "지금 종합적으로 가장 뜨는 주제"를 보여줍니다.
- 결과는 서버에서 15분 캐시되며, `↻ 새로고침` 버튼으로 강제 갱신할 수 있습니다.
- 환경변수:
  - `PORT` — 기본 8100 (섹터 에이전트의 8000과 분리)
  - `APP_PASSWORD` — 공개 배포 시 접속 비밀번호 (섹터 에이전트와 동일한 방식)
  - `YOUTUBE_API_KEY` — 선택. 설정하면 YouTube 공식 Data API로 더 안정적으로 수집 (미설정 시 인기 급상승 페이지 파싱)
  - `TREND_CACHE_TTL` — 캐시 초 (기본 900)

> 참고: Instagram은 공개 트렌드 API가 없어 Google News 기반 관련 소식으로 집계합니다. TikTok은 크리에이티브 센터의 비공식 엔드포인트를 사용하므로 간헐적으로 응답이 막힐 수 있으며, 이 경우 해당 카드에만 오류가 표시되고 나머지는 정상 동작합니다. YouTube는 트렌딩 페이지가 막히면 내부 JSON API(Innertube)로 자동 재시도합니다.

### 클라우드 배포 (어디서나 접속)

저장소의 `render.yaml`에 트렌드 대시보드 서비스(`sns-trend-dashboard`)가 포함되어 있습니다.

1. [render.com](https://render.com) → **New + → Blueprint** → 이 저장소 선택 (브랜치 선택 가능)
2. `sector-news-agent`와 `sns-trend-dashboard` 두 서비스가 자동 인식됩니다 — 트렌드 대시보드만 원하면 나머지는 건너뛰어도 됩니다.
3. 트렌드 대시보드는 **API 키·비밀번호 없이 바로 동작**합니다 (환경변수 입력 전부 선택사항). 배포가 끝나면 발급된 URL로 어디서나 접속하세요.

---

## 동작 방식

1. **섹터 리서치** — `config.yaml`에 정의한 섹터마다 Claude가 웹 검색(`web_search`)과 페이지 조회(`web_fetch`)로 최근 주요 이슈를 수집하고, 사실/시장 반응/투자 의미/출처를 정리한 브리핑을 작성합니다.
2. **종합 리포트** — 섹터 브리핑들을 종합해 핵심 요약, 국내/해외 섹터 분석, 단기·중기 투자 관점, 리스크 요인, 출처가 담긴 리포트를 `reports/YYYY-MM-DD_sector_report.md`로 저장합니다.

## 두 가지 백엔드 (비용 선택)

`config.yaml`의 `backend.type`으로 LLM 백엔드를 고릅니다.

| `backend.type` | 비용 | 품질 | 뉴스 수집 | 필요 조건 |
|---|---|---|---|---|
| `claude` (기본) | API 크레딧(유료) | 높음 | Claude 내장 웹검색 | `ANTHROPIC_API_KEY` |
| `ollama` | **무료** | 중간 | Google News RSS(무료) | 로컬에 [Ollama](https://ollama.com) 설치·실행 |

> ⚠️ **claude.ai 구독(Pro/Max)으로는 동작하지 않습니다.** 구독과 Claude API는 별개의 결제 체계로, `claude` 백엔드는 API 크레딧이 필요합니다. 비용 없이 쓰려면 `ollama` 백엔드를 사용하세요.

### 무료 로컬 모드 (ollama) 설정

```bash
# 1) Ollama 설치 (https://ollama.com) 후 모델 받기
ollama pull qwen2.5:72b        # 128GB RAM 권장. 16GB면 qwen2.5:7b

# 2) config.yaml에서 backend.type을 ollama로
#    backend:
#      type: ollama
#      ollama:
#        model: qwen2.5:72b

# 3) 실행 (API 키 불필요)
python -m sector_news_agent          # CLI
python -m sector_news_agent.web      # 웹 UI
```

로컬 모델은 웹 검색 기능이 없어, 섹터 키워드로 **Google News RSS**(무료)에서 최근 기사를 모아 모델에 넣고 브리핑·리포트를 작성합니다. Ollama 서버(`ollama serve`)가 떠 있어야 합니다.

### 맥북 무료 영구 자동화 (매일 오전 7시)

macOS `launchd`로 매일 오전 7시에 자동 실행합니다. **비용 0원**이며, 맥북이 7시에 잠자기 상태여도 **깨어나는 즉시 놓친 작업을 실행**합니다(cron과의 차이).

```bash
# 1) Ollama 설치(https://ollama.com) 후
git clone https://github.com/giyeongkeem/main.git && cd main

# 2) 설치 스크립트 실행 — venv·의존성·모델 다운로드·launchd 등록까지 한 번에
bash scripts/install_macos.sh

# 3) 즉시 한 번 테스트
bash scripts/run_daily.sh          # reports/ 에 .md + .html 생성
```

- 리포트는 `reports/YYYY-MM-DD_sector_report.md` + `.html`로 저장됩니다.
- 로그: `logs/daily.err.log`
- 해제: `launchctl unload ~/Library/LaunchAgents/com.sectornews.dailyreport.plist`

### 아카이빙 (GitHub + Notion 자동 보관)

리포트 생성 후 자동으로 두 곳에 보관합니다. `config.yaml`의 `archive` 섹션에서 켜고 끕니다.

**① GitHub** (`archive.git: true`) — `reports/` 변경분을 커밋하고 현재 브랜치에 푸시합니다. 맥북에 해당 저장소 push 권한(git 인증)이 되어 있으면 추가 설정이 없습니다.

**② Notion** (`archive.notion.database_id`) — "섹터 리포트 아카이브" 데이터베이스에 날짜별 페이지를 만듭니다. 최초 1회 설정:

1. [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → **New integration** (Internal) → 워크스페이스 선택 → 생성 후 **시크릿 키 복사** (`ntn_...` 또는 `secret_...`)
2. Notion에서 **섹터 리포트 아카이브** 데이터베이스 페이지 열기 → 우상단 `⋯` → **연결(Connections)** → 방금 만든 통합 추가
3. 저장소 루트에 `.env` 파일 생성 (git에 커밋되지 않음):
   ```
   NOTION_API_KEY=여기에_시크릿_키
   ```

키가 없거나 실패해도 리포트 생성 자체는 정상 진행됩니다(아카이빙만 생략).

### 옵시디언(Obsidian)으로 읽기·메모하기

리포트가 로컬 Markdown으로 쌓이므로 옵시디언과 바로 연동됩니다. 추가 파이프라인 없음.

1. [옵시디언](https://obsidian.md) 설치 → **보관함으로 폴더 열기** → 이 저장소 폴더(`~/main`) 선택
2. 설정 → 커뮤니티 플러그인 → 제한 모드 해제 → **Dataview** 검색·설치·활성화
3. **`옵시디언 대시보드`** 노트를 열면 최근 리포트 목록·월별 통계가 자동 표시됩니다

리포트 `.md` 상단에 자동으로 붙는 frontmatter(`date`, `sectors`, `tags`)를 Dataview가 읽습니다. 리포트에 직접 메모를 추가하거나 `[[종목명]]` 백링크로 종목별 히스토리를 쌓는 활용을 추천합니다. (`.obsidian/` 설정 폴더는 git에서 제외됩니다)

> 맥북이 7시에 완전히 꺼져 있으면 실행되지 않습니다(잠자기는 OK). 전원이 켜져 있고 잠자기 상태이기만 하면 됩니다.

## 사용법

실행 방법은 3가지입니다: **로컬 웹 UI**, **클라우드 배포(어디서나 접속)**, **GitHub Actions(매일 자동)**.

### 1) 로컬 웹 UI

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...

python -m sector_news_agent.web             # http://localhost:8000
# 또는: ANTHROPIC_API_KEY=sk-ant-... ./run_local.sh
```

브라우저에서 접속 후 **리포트 생성** 버튼을 누르면 섹터별 리서치 → 종합 리포트 생성 과정이 실시간으로 표시되고, 완료된 리포트가 화면에 렌더링됩니다. 과거 리포트 목록도 확인할 수 있습니다. 로컬에서는 비밀번호 없이 바로 사용합니다.

### 2) 클라우드 배포 (PC를 켜두지 않아도 어디서나 접속)

[Render](https://render.com), Railway, Fly.io 등에 배포하면 아이폰·PC 어디서나 URL로 접속해 버튼 클릭으로 생성할 수 있습니다. 저장소에 `Dockerfile`과 `render.yaml`이 포함되어 있습니다.

**Render 예시:**
1. 이 저장소를 GitHub에 푸시
2. render.com → **New + → Blueprint** → 저장소 선택 (`render.yaml` 자동 인식)
3. 배포 후 **Environment** 탭에서 두 값 입력:
   - `ANTHROPIC_API_KEY` — Claude API 키
   - `APP_PASSWORD` — **공개 URL 접속용 비밀번호 (필수)**
4. 발급된 URL에 접속 → 브라우저가 비밀번호를 물어봄 (아이디는 아무 값, 비밀번호는 `APP_PASSWORD` 값)

> ⚠️ 공개 URL은 누구나 접속하면 **API 비용**이 발생합니다. 배포 시 `APP_PASSWORD`를 반드시 설정하세요. (로컬에서는 미설정 시 무인증으로 동작합니다.)

Docker로 직접 띄우려면:

```bash
docker build -t sector-agent .
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=sk-ant-... -e APP_PASSWORD=내비밀번호 sector-agent
```

### 3) CLI

```bash
python -m sector_news_agent                 # config.yaml 기준 실행
python -m sector_news_agent --config my.yaml --output today.md
```

진행 상황(검색 중인 섹터, 도구 실행, 생성 중인 텍스트)은 stderr로 스트리밍됩니다.

## 관심 섹터 설정

`config.yaml`의 `sectors` 아래에 자유롭게 추가/수정하세요.

```yaml
sectors:
  domestic:
    - name: 반도체
      keywords: [삼성전자, SK하이닉스, HBM]
  overseas:
    - name: AI / 빅테크
      keywords: [NVIDIA, Microsoft, AI 데이터센터]
```

- `name`: 섹터 이름 (리포트 제목에 사용)
- `keywords`: 검색 정확도를 높이기 위한 힌트 (종목명, 테마 등)

`model` 섹션에서 모델, effort(`low`/`medium`/`high`/`max`), 섹터당 최대 웹 검색 횟수(비용 제어)를 조정할 수 있습니다.

### 4) 매일 자동 실행 (GitHub Actions)

`.github/workflows/daily-report.yml`이 매일 한국시간 오전 7시 30분에 리포트를 생성해 `reports/`에 커밋합니다.

사용하려면 저장소 **Settings → Secrets and variables → Actions**에 `ANTHROPIC_API_KEY` 시크릿을 등록하세요. Actions 탭에서 `Daily Sector Report` 워크플로우를 수동 실행(`workflow_dispatch`)할 수도 있습니다.

## 비용 참고

- 모델: 기본 `claude-opus-4-8` (입력 $5 / 출력 $25 per 1M tokens)
- 웹 검색은 섹터당 `max_web_searches_per_sector`(기본 8회)로 제한됩니다.
- 섹터 수를 늘리면 호출 횟수가 비례해서 늘어납니다.

> 본 에이전트가 생성하는 리포트는 정보 제공 목적이며 투자 권유가 아닙니다.
