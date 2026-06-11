# 🎬 Shorts Studio

맥에서 주제만 입력하면 유튜브 쇼츠 영상(9:16, 1080×1920, 60초 이내)을 자동으로 만들어 주는 로컬 웹 대시보드입니다.

**파이프라인:** 주제 입력 → Claude API 스크립트 생성 → edge-tts 음성 합성(무료) → Pexels 무료 스톡 배경 영상 → 단어 타이밍 기반 자막(ASS) → ffmpeg 렌더링 → mp4 다운로드

업로드는 자동화하지 않습니다. 대신 생성된 **제목·설명·태그**를 대시보드에서 복사해 유튜브에 붙여넣으면 됩니다.

## 설치 (macOS)

```bash
# 1. ffmpeg 설치
brew install ffmpeg

# 2. 파이썬 가상환경 + 의존성
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. API 키 설정
cp .env.example .env
# .env 파일을 열어 키를 입력하세요
```

### API 키

| 키 | 필수 여부 | 발급처 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 권장 (없으면 샘플 스크립트 모드) | https://console.anthropic.com |
| `PEXELS_API_KEY` | 선택 (없으면 단색 배경) | https://www.pexels.com/api/ (무료) |

## 실행

```bash
source .venv/bin/activate
./run.sh
```

실행하면 접속 주소 두 개가 출력됩니다:

- **맥에서:** http://127.0.0.1:8000
- **아이폰에서:** `http://<맥의 IP>:8000` — 아이폰이 맥과 **같은 Wi-Fi**에 연결돼 있어야 합니다. 주소는 run.sh가 자동으로 찾아 출력합니다.

주제 입력 → 생성 → 완료되면 미리보기·다운로드. 아이폰 Safari에서 공유 버튼 → "홈 화면에 추가"를 하면 앱처럼 쓸 수 있습니다.

> 처음 실행 시 macOS가 "들어오는 네트워크 연결을 허용하시겠습니까?"라고 물으면 **허용**을 눌러야 아이폰에서 접속됩니다. 맥에서만 쓸 거라면 `uvicorn app.main:app --port 8000`으로 실행하세요 (외부 접속 차단).

## 외부(셀룰러)에서 접속하기

집 밖이나 셀룰러 환경에서 접속하려면 Cloudflare 무료 터널을 사용합니다 (계정 불필요):

```bash
brew install cloudflared   # 처음 한 번만
./run-public.sh
```

실행하면 공개 HTTPS 주소와 접속 비밀번호가 출력됩니다:

```
주소:       https://xxxx-xxxx.trycloudflare.com
사용자 이름: 아무거나 (예: me)
비밀번호:    qmysrt2xb33h
```

- 비밀번호는 처음 실행할 때 자동 생성되어 `.env`의 `DASHBOARD_PASSWORD`에 저장됩니다 (직접 바꿔도 됨). 비밀번호가 설정되면 LAN 접속을 포함한 모든 접속에 로그인(사용자 이름 아무거나 + 비밀번호)이 필요합니다.
- 공개 주소는 실행할 때마다 바뀌고, 터미널을 닫으면 접속이 끊깁니다.
- 항상 같은 주소가 필요하거나 더 안전하게 쓰려면 Tailscale을 권장합니다 (아래).

### Tailscale로 고정 주소 만들기 (권장)

[Tailscale](https://tailscale.com)은 내 기기들끼리만 연결되는 무료 개인 VPN입니다. 터널과 달리 주소가 고정이고, 외부에 아무것도 공개되지 않습니다.

1. **맥**: App Store에서 "Tailscale" 설치 → 실행 → Google/Apple 계정으로 로그인
2. **아이폰**: App Store에서 "Tailscale" 설치 → **같은 계정**으로 로그인 → VPN 토글 켜기
3. **맥에서 실행**: `./run.sh` — Tailscale이 켜져 있으면 `셀룰러: http://100.x.x.x:8000` 주소가 자동으로 출력됩니다
4. 아이폰에서 그 주소로 접속 (Wi-Fi든 셀룰러든 어디서든)

맥이 켜져 있고 양쪽 Tailscale이 로그인되어 있는 동안 항상 같은 주소로 접속됩니다.

## 동작 방식

1. **스크립트** — Claude(`claude-opus-4-8`, `.env`의 `SHORTS_MODEL`로 변경 가능)가 훅 중심의 4~6 세그먼트 대본과 제목/설명/태그를 구조화 출력으로 생성합니다. 한국어/영어 선택 가능.
2. **음성** — edge-tts(무료)가 세그먼트별 mp3를 합성하고, 단어 단위 타이밍(WordBoundary)을 수집합니다. 음성: `ko-KR-SunHiNeural` / `en-US-AriaNeural`.
3. **배경** — Pexels에서 세로 스톡 영상을 세그먼트 키워드로 검색·다운로드합니다. 키가 없거나 검색 실패 시 해당 세그먼트는 단색 배경으로 대체됩니다.
4. **자막** — 단어 타이밍을 2~3단어 청크로 묶어 쇼츠 스타일 ASS 자막을 만듭니다. 폰트는 `Apple SD Gothic Neo`(맥 기본, 한·영 지원).
5. **렌더링** — ffmpeg 3-pass: 세그먼트 정규화(1080×1920/30fps) → concat → 자막 번인 + 내레이션 먹스 → `output/<작업ID>/short.mp4`.

## 테스트

```bash
# 유닛테스트 (자막 타이밍/ASS 생성)
pytest tests/

# API 키 없이 전체 파이프라인 테스트 (샘플 스크립트 + 단색 배경)
MOCK_SCRIPT=1 uvicorn app.main:app --port 8000

# 완전 오프라인 (TTS까지 목으로 대체)
MOCK_SCRIPT=1 MOCK_TTS=1 uvicorn app.main:app --port 8000
```

## 구조

```
app/
  main.py            # FastAPI 라우트 + 정적 파일 서빙
  config.py          # .env 설정
  db.py              # SQLite 작업 저장소
  models.py          # Pydantic 모델 (스크립트 구조화 출력 포함)
  pipeline/
    runner.py        # 작업 큐 워커 (한 번에 하나씩 FIFO 처리)
    script.py        # Claude API 스크립트 생성
    tts.py           # edge-tts 합성 + 단어 타이밍
    visuals.py       # Pexels 검색/다운로드
    subtitles.py     # 단어 타이밍 → ASS 자막
    render.py        # ffmpeg 3-pass 렌더링
  static/            # 대시보드 (HTML/CSS/JS)
fixtures/            # 키 없이 테스트할 샘플 스크립트
output/<job_id>/     # short.mp4 + metadata.json
```
