# CLAUDE.md

국내·해외 주식 섹터 뉴스를 수집해 한국어 데일리 투자 리포트(Markdown + HTML)를 생성하는 에이전트.
순수 Python(패키지 `sector_news_agent/`, ~1,000줄), 테스트 스위트 없음.

## 구조

| 파일 | 역할 |
|---|---|
| `sector_news_agent/agent.py` | 파이프라인: 섹터별 리서치 → 종합 리포트 → 저장 → 아카이빙 |
| `sector_news_agent/backends.py` | LLM 백엔드 추상화 (`ClaudeBackend` = 서버사이드 web_search 내장 / `OllamaBackend` = 로컬, 도구 없음) |
| `sector_news_agent/news.py` | ollama 백엔드용 무료 뉴스 수집 (Google News RSS, 헤드라인만) |
| `sector_news_agent/config.py` | `config.yaml` 로딩 + 환경변수 오버라이드 |
| `sector_news_agent/archive.py` | GitHub 커밋·푸시 + Notion DB 페이지 생성 (실패해도 리포트 생성은 성공 처리) |
| `sector_news_agent/web.py` | FastAPI 웹 UI (SSE 진행 스트림, `APP_PASSWORD`로 Basic 인증) |
| `scripts/` | macOS launchd 설치·데일리 실행 스크립트 |

## 핵심 규칙: config.yaml은 로컬 기준, 환경별 차이는 환경변수로

`config.yaml`은 맥북 로컬 무료 모드(`backend.type: ollama`, `archive.git: true`) 기준으로 커밋한다.
**config.yaml을 실행 환경에 맞춰 고쳐 커밋하지 말 것** — 대신 환경변수 오버라이드를 쓴다:

- `SECTOR_AGENT_BACKEND=claude|ollama` — 백엔드 강제 (CI는 `claude`)
- `SECTOR_AGENT_ARCHIVE_GIT=true|false` — 에이전트 내부 git 커밋·푸시 on/off
  (GitHub Actions에서는 `false` — 워크플로의 "Commit report" 스텝이 커밋을 전담하므로 중복 금지)

claude 백엔드는 `ANTHROPIC_API_KEY` 필요. Notion 아카이빙은 `NOTION_API_KEY` 필요(없으면 조용히 생략).

## 실행·확인

```bash
pip install -r requirements.txt
python -m sector_news_agent              # CLI (진행 상황은 stderr)
python -m sector_news_agent.web          # 웹 UI http://localhost:8000
# 설정 로딩 스모크 테스트
python3 -c "from sector_news_agent.config import load_config; print(load_config().backend)"
```

## 자동화 지도 (중복 주의)

같은 주제(투자 뉴스 브리핑)의 데일리 자동화가 **세 갈래** 존재한다. 스케줄을 바꾸거나 새 자동화를 추가할 때 반드시 함께 고려할 것:

1. **GitHub Actions** — `.github/workflows/daily-report.yml`, 매일 22:30 UTC(KST 07:30), claude 백엔드 강제, `reports/`에 커밋
2. **macOS launchd** — `scripts/run_daily.sh`, 매일 KST 07:00, ollama(무료) 백엔드, 로컬 맥북에서 실행
3. **claude.ai 루틴(저장소 외부)** — "Daily tech investment briefing → Notion 아카이브", 매일 22:00 UTC(KST 07:00), 신규 클로드 세션에서 AI/빅테크 뉴스 브리핑을 생성하고 Notion "섹터 리포트 아카이브" DB에 "YYYY-MM-DD 데일리 테크 브리핑" 페이지로 저장. 이 저장소 코드와 무관하게 별도로 돈다.

## 아카이빙

- 리포트: `reports/YYYY-MM-DD_sector_report.md` + `.html`
- Notion: "섹터 리포트 아카이브" DB (`config.yaml`의 `archive.notion.database_id`). 사용자 claude.ai 계정에 Notion 커넥터가 연결되어 있으므로, 클로드 세션에서 아카이브 DB를 직접 조회·수정할 수 있다.

## 컨벤션

- 주석·문서·리포트·커밋 메시지 모두 **한국어**
- HTTP는 표준 라이브러리 `urllib` 사용 (anthropic·fastapi 외 의존성 최소화 유지)
- 장시간 작업은 `progress(kind, message)` 콜백으로 진행 상황 전달 (`kind`: `status` | `tool` | `text`)
- 모델·비용: 기본 `claude-opus-4-8`, 섹터당 웹 검색 상한 `model.max_web_searches_per_sector`(기본 8)로 비용 제어
