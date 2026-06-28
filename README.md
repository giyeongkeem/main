# 섹터 뉴스 리포트 에이전트

국내·해외 관심 주식 섹터의 주요 이슈를 실시간 웹 검색으로 수집하고, 투자 관점에서 정리한 데일리 리포트(Markdown)를 생성하는 에이전트입니다.

Claude API의 서버사이드 웹 검색/페치 도구를 사용하므로 별도의 뉴스 API 키 없이 동작합니다.

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
