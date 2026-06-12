# 섹터 뉴스 리포트 에이전트

국내·해외 관심 주식 섹터의 주요 이슈를 실시간 웹 검색으로 수집하고, 투자 관점에서 정리한 데일리 리포트(Markdown)를 생성하는 에이전트입니다.

Claude API의 서버사이드 웹 검색/페치 도구를 사용하므로 별도의 뉴스 API 키 없이 동작합니다.

## 동작 방식

1. **섹터 리서치** — `config.yaml`에 정의한 섹터마다 Claude가 웹 검색(`web_search`)과 페이지 조회(`web_fetch`)로 최근 주요 이슈를 수집하고, 사실/시장 반응/투자 의미/출처를 정리한 브리핑을 작성합니다.
2. **종합 리포트** — 섹터 브리핑들을 종합해 핵심 요약, 국내/해외 섹터 분석, 단기·중기 투자 관점, 리스크 요인, 출처가 담긴 리포트를 `reports/YYYY-MM-DD_sector_report.md`로 저장합니다.

## 필요한 것

**Claude API 키 1개**(`ANTHROPIC_API_KEY`)만 있으면 됩니다. 웹 검색이 Claude의 서버사이드 도구로 동작하므로 별도의 뉴스 API 키는 필요 없습니다. 키는 [console.anthropic.com](https://console.anthropic.com)에서 발급합니다.

## 사용법

### 웹 UI (권장)

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...

python -m sector_news_agent.web             # http://localhost:8000
```

브라우저에서 접속 후 **리포트 생성** 버튼을 누르면 섹터별 리서치 → 종합 리포트 생성 과정이 실시간으로 표시되고, 완료된 리포트가 화면에 렌더링됩니다. 과거 리포트 목록도 확인할 수 있습니다.

### CLI

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

## 매일 자동 실행 (GitHub Actions)

`.github/workflows/daily-report.yml`이 매일 한국시간 오전 7시 30분에 리포트를 생성해 `reports/`에 커밋합니다.

사용하려면 저장소 **Settings → Secrets and variables → Actions**에 `ANTHROPIC_API_KEY` 시크릿을 등록하세요. Actions 탭에서 `Daily Sector Report` 워크플로우를 수동 실행(`workflow_dispatch`)할 수도 있습니다.

## 비용 참고

- 모델: 기본 `claude-opus-4-8` (입력 $5 / 출력 $25 per 1M tokens)
- 웹 검색은 섹터당 `max_web_searches_per_sector`(기본 8회)로 제한됩니다.
- 섹터 수를 늘리면 호출 횟수가 비례해서 늘어납니다.

> 본 에이전트가 생성하는 리포트는 정보 제공 목적이며 투자 권유가 아닙니다.
