"""웹 UI: 브라우저에서 리포트 생성을 실행하고 진행 상황을 실시간으로 본다.

로컬 실행:
    export ANTHROPIC_API_KEY=sk-ant-...
    python -m sector_news_agent.web          # http://localhost:8000

클라우드 배포 시(공개 URL): APP_PASSWORD 환경변수를 설정하면 접속에 비밀번호를
요구합니다(아이디는 아무 값, 비밀번호는 APP_PASSWORD). 설정하지 않으면 누구나
접속해 API 비용을 발생시킬 수 있으니 배포 시 반드시 설정하세요.
"""

from __future__ import annotations

import json
import os
import queue
import secrets
import threading

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import HTMLResponse, PlainTextResponse, StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from .agent import run
from .config import load_config

CONFIG_PATH = os.environ.get("SECTOR_AGENT_CONFIG", "config.yaml")
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")

app = FastAPI(title="섹터 뉴스 리포트 에이전트")

_basic = HTTPBasic(auto_error=False)


def require_auth(credentials: HTTPBasicCredentials | None = Depends(_basic)) -> None:
    """APP_PASSWORD가 설정된 경우에만 HTTP Basic 인증을 요구한다 (로컬은 무인증)."""
    if not APP_PASSWORD:
        return
    if credentials is None or not secrets.compare_digest(credentials.password, APP_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비밀번호가 필요합니다.",
            headers={"WWW-Authenticate": "Basic"},
        )

# 동시에 1개의 생성 작업만 허용하는 단순 작업 상태
_lock = threading.Lock()
_state: dict = {"running": False, "queue": None}


def _worker(q: queue.Queue) -> None:
    def progress(kind: str, message: str) -> None:
        q.put({"kind": kind, "message": message})

    try:
        cfg = load_config(CONFIG_PATH)
        path = run(cfg, progress=progress)
        q.put({"kind": "done", "report": path.name})
    except Exception as e:  # 진행 스트림으로 오류를 전달
        q.put({"kind": "error", "message": str(e)})
    finally:
        with _lock:
            _state["running"] = False


@app.post("/api/generate")
def generate(_: None = Depends(require_auth)) -> dict:
    cfg = load_config(CONFIG_PATH)
    if cfg.backend == "claude" and not (
        os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")
    ):
        raise HTTPException(500, "서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다. (claude 백엔드)")
    with _lock:
        if _state["running"]:
            raise HTTPException(409, "이미 리포트를 생성 중입니다.")
        q: queue.Queue = queue.Queue()
        _state.update(running=True, queue=q)
    threading.Thread(target=_worker, args=(q,), daemon=True).start()
    return {"started": True}


@app.get("/api/progress")
def progress_stream(_: None = Depends(require_auth)) -> StreamingResponse:
    q = _state.get("queue")
    if q is None:
        raise HTTPException(404, "진행 중인 작업이 없습니다.")

    def events():
        while True:
            try:
                item = q.get(timeout=120)
            except queue.Empty:
                yield ": keepalive\n\n"
                continue
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
            if item["kind"] in ("done", "error"):
                break

    return StreamingResponse(events(), media_type="text/event-stream")


@app.get("/api/sectors")
def sectors(_: None = Depends(require_auth)) -> list[dict]:
    cfg = load_config(CONFIG_PATH)
    return [{"region": s.region_label, "name": s.name} for s in cfg.sectors]


@app.get("/api/reports")
def list_reports(_: None = Depends(require_auth)) -> list[str]:
    cfg = load_config(CONFIG_PATH)
    if not cfg.output_dir.is_dir():
        return []
    return sorted((p.name for p in cfg.output_dir.glob("*.md")), reverse=True)


@app.get("/api/reports/{name}")
def get_report(name: str, _: None = Depends(require_auth)) -> PlainTextResponse:
    if "/" in name or "\\" in name or not name.endswith(".md"):
        raise HTTPException(400, "잘못된 파일명입니다.")
    cfg = load_config(CONFIG_PATH)
    path = cfg.output_dir / name
    if not path.is_file():
        raise HTTPException(404, "리포트가 없습니다.")
    return PlainTextResponse(path.read_text(encoding="utf-8"))


INDEX_HTML = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>섹터 뉴스 리포트 에이전트</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  body { font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
         max-width: 960px; margin: 0 auto; padding: 24px; color: #1a1a2e; }
  h1 { font-size: 1.5rem; }
  button { padding: 10px 20px; font-size: 1rem; border: 0; border-radius: 8px;
           background: #2d6cdf; color: #fff; cursor: pointer; }
  button:disabled { background: #9bb5e8; cursor: wait; }
  .row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; margin-top: 16px; }
  .panel { flex: 1; min-width: 300px; }
  #sectors li { margin: 2px 0; }
  #log { background: #0f172a; color: #d1e3ff; padding: 12px; border-radius: 8px;
         height: 260px; overflow-y: auto; font: 12px/1.5 monospace; white-space: pre-wrap; }
  #log .status { color: #7dd3a8; font-weight: bold; }
  #log .tool { color: #fbbf24; }
  #report { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 16px; }
  #reports a { display: block; margin: 4px 0; }
  .muted { color: #777; font-size: 0.85rem; }
</style>
</head>
<body>
<h1>📈 섹터 뉴스 리포트 에이전트</h1>
<p class="muted">국내·해외 관심 섹터의 주요 이슈를 웹 검색으로 수집해 투자 관점 리포트를 생성합니다.</p>
<button id="go">리포트 생성</button>

<div class="row">
  <div class="panel">
    <h3>관심 섹터</h3>
    <ul id="sectors"></ul>
    <h3>생성된 리포트</h3>
    <div id="reports" class="muted">없음</div>
  </div>
  <div class="panel">
    <h3>진행 상황</h3>
    <div id="log">대기 중...</div>
  </div>
</div>

<div id="report" hidden></div>

<script>
const $ = (id) => document.getElementById(id);

async function loadSectors() {
  const list = await (await fetch('/api/sectors')).json();
  $('sectors').innerHTML = list.map(s => `<li>[${s.region}] ${s.name}</li>`).join('');
}

async function loadReports() {
  const list = await (await fetch('/api/reports')).json();
  $('reports').innerHTML = list.length
    ? list.map(n => `<a href="#" onclick="showReport('${n}');return false">${n}</a>`).join('')
    : '없음';
  return list;
}

async function showReport(name) {
  const md = await (await fetch('/api/reports/' + encodeURIComponent(name))).text();
  $('report').hidden = false;
  $('report').innerHTML = marked.parse(md);
  $('report').scrollIntoView({behavior: 'smooth'});
}

function appendLog(kind, message) {
  const log = $('log');
  if (kind === 'text') {
    log.append(document.createTextNode(message));
  } else {
    const div = document.createElement('div');
    div.className = kind;
    div.textContent = message;
    log.append(div);
  }
  log.scrollTop = log.scrollHeight;
}

$('go').onclick = async () => {
  const btn = $('go');
  btn.disabled = true;
  $('log').textContent = '';
  try {
    const res = await fetch('/api/generate', {method: 'POST'});
    if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  } catch (e) {
    appendLog('status', '오류: ' + e.message);
    btn.disabled = false;
    return;
  }
  const es = new EventSource('/api/progress');
  es.onmessage = async (ev) => {
    const item = JSON.parse(ev.data);
    if (item.kind === 'done') {
      es.close();
      btn.disabled = false;
      appendLog('status', '✅ 완료: ' + item.report);
      await loadReports();
      showReport(item.report);
    } else if (item.kind === 'error') {
      es.close();
      btn.disabled = false;
      appendLog('status', '❌ 오류: ' + item.message);
    } else {
      appendLog(item.kind, item.message + (item.kind !== 'text' ? '' : ''));
    }
  };
  es.onerror = () => { es.close(); btn.disabled = false; };
};

loadSectors();
loadReports();
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def index(_: None = Depends(require_auth)) -> str:
    return INDEX_HTML


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
