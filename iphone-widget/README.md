# 📱 Claude Code + Codex 사용량 iPhone 위젯

아이폰 **홈 화면**과 **잠금 화면**에서 Claude Code와 ChatGPT Codex 사용량(5시간 세션 %, 주간 %, 오늘 비용/토큰)을 바로 확인하는 위젯입니다.

앱 개발 없이 무료 앱 [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)로 동작합니다.

```
┌─────────────────────────────┐
│ ● Claude Code           42% │
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░ │
│ 5시간 42% · 주간 13% · 오늘 $8.20│
│                             │
│ ● Codex                 18% │
│ ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░ │
│ 5시간 18% · 주간 7% · 오늘 $1.10 │
└─────────────────────────────┘
```

## 동작 구조

아이폰은 Mac에 있는 CLI 로그를 직접 읽을 수 없으므로, 2단계로 나뉩니다.

1. **수집기 (Mac)** — `collector/collect_usage.py`가 10분마다 실행되어
   - Claude Code: `~/.claude/projects/**/*.jsonl` 토큰/비용 집계 + OAuth 사용량 API로 공식 리밋 %(가능한 경우)
   - Codex: `~/.codex/sessions/**/*.jsonl` 토큰 집계 + 로그에 기록된 공식 리밋 %(`rate_limits`)
   - 결과를 `usage.json`으로 **비공개 GitHub Gist**에 업로드
2. **위젯 (iPhone)** — Scriptable의 `UsageWidget.js`가 Gist JSON을 읽어 홈/잠금 화면에 표시

## 설치

### 1단계 — Mac에서 수집기 설정

```bash
# GitHub 토큰 발급: https://github.com/settings/tokens → "gist" 권한만 체크

# 최초 1회: gist 생성 (gist id와 위젯 URL이 출력됨)
GITHUB_TOKEN=ghp_xxx python3 collector/collect_usage.py --create-gist
```

출력된 **위젯 URL**과 **gist id**를 기록해 두세요.

10분마다 자동 실행되도록 launchd 등록:

```bash
# com.usage-widget.collector.plist 안의 3곳(스크립트 경로, 토큰, gist id)을 수정한 뒤
cp collector/com.usage-widget.collector.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.usage-widget.collector.plist
```

동작 확인:

```bash
python3 collector/collect_usage.py --no-upload   # JSON이 stdout에 출력되면 정상
```

### 2단계 — iPhone에서 위젯 설정

1. App Store에서 **Scriptable** 설치 (무료)
2. Scriptable → `+` → `scriptable/UsageWidget.js` 내용 전체 붙여넣기 → 이름 `UsageWidget`로 저장
3. 스크립트 상단의 `DATA_URL`을 1단계에서 출력된 위젯 URL로 교체
4. 위젯 추가:
   - **홈 화면**: 길게 눌러 편집 → `+` → Scriptable → 소형/중형 선택 → 위젯 길게 눌러 *위젯 편집* → Script: `UsageWidget`
   - **잠금 화면**: 잠금 화면 길게 눌러 *사용자화* → 위젯 추가 → Scriptable → 사각형/원형/인라인 선택 → Script: `UsageWidget`
     - 원형 위젯은 Parameter에 `claude` 또는 `codex`를 입력해 어떤 도구를 표시할지 선택

## 위젯 종류별 표시 내용

| 위젯 | 표시 내용 |
|---|---|
| 홈 소형 | 두 도구의 5시간 % 게이지 + 주간 % + 오늘 비용 |
| 홈 중형 | 위 내용 + 오늘 토큰 수, 업데이트 시각 |
| 잠금 사각형 | `CC ▓▓▓░ 42%·주13%` / `CX ▓░░░ 18%·주7%` 두 줄 |
| 잠금 원형 | 선택한 도구(파라미터)의 5시간 % 링 게이지 |
| 잠금 인라인 | `CC 42% · CX 18%` 한 줄 |

게이지 색상: 70% 이상 노란색, 90% 이상 빨간색으로 경고. 데이터가 90분 이상 오래되면 ⚠︎ 표시(Mac이 꺼져 있거나 수집기가 멈춘 경우).

## 참고 사항

- **비용은 API 단가 기준 추정치**입니다. Pro/Max·Plus 구독이면 실제 청구액이 아니라 "썼다면 이만큼" 환산값입니다.
- **Claude 리밋 %**: Claude Code OAuth 토큰(`~/.claude/.credentials.json`)으로 공식 사용률 조회를 시도합니다. 비공개 API라 스키마가 바뀌면 %가 비어 나올 수 있고, 그 경우에도 토큰/비용 집계는 정상 표시됩니다.
- **Codex 리밋 %**: Codex CLI가 세션 로그에 남기는 공식 `rate_limits` 값을 그대로 사용하므로 정확합니다(마지막 Codex 사용 시점 기준).
- Gist는 **비공개(secret)**로 생성되지만 URL을 아는 사람은 볼 수 있습니다. 사용량 통계만 담겨 있고 대화 내용·토큰(자격증명)은 포함되지 않습니다.
- 수집기는 파이썬 표준 라이브러리만 사용합니다 (별도 설치 불필요, macOS 기본 python3 동작).
