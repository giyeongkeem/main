import asyncio
import base64
import secrets
import shutil
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from . import config, db
from .models import JobCreate, JobOut
from .pipeline import runner


@asynccontextmanager
async def lifespan(app: FastAPI):
    config.OUTPUT_DIR.mkdir(exist_ok=True)
    db.init()
    # The in-memory queue does not survive a restart; any job left mid-flight
    # would otherwise show 'in progress' forever. Fail them so the state is honest.
    stale = db.fail_stale_jobs("서버가 재시작되어 작업이 중단되었습니다. 다시 생성해 주세요.")
    if stale:
        print(f"[startup] marked {stale} interrupted job(s) as failed")
    worker_task = asyncio.create_task(runner.worker())
    yield
    worker_task.cancel()


app = FastAPI(title="Shorts Studio", lifespan=lifespan)


@app.middleware("http")
async def basic_auth(request, call_next):
    if config.DASHBOARD_PASSWORD:
        header = request.headers.get("authorization", "")
        ok = False
        if header.startswith("Basic "):
            try:
                decoded = base64.b64decode(header[6:]).decode()
                _, _, supplied = decoded.partition(":")
                ok = secrets.compare_digest(supplied, config.DASHBOARD_PASSWORD)
            except Exception:
                ok = False
        if not ok:
            return Response(
                status_code=401,
                headers={"WWW-Authenticate": 'Basic realm="Shorts Studio"'},
            )
    return await call_next(request)


def _to_out(job: dict) -> JobOut:
    # 'completed' is set only after the mp4 is written, so status is an
    # authoritative has_video flag — no per-request filesystem stat needed.
    return JobOut(
        id=job["id"],
        topic=job["topic"],
        language=job["language"],
        status=job["status"],
        progress=job["progress"],
        error=job["error"],
        created_at=job["created_at"],
        has_video=job["status"] == "completed",
        metadata=job["metadata"],
    )


@app.get("/api/health")
async def health():
    return config.health()


@app.post("/api/jobs", status_code=201)
async def create_job(payload: JobCreate):
    job_id = uuid.uuid4().hex[:12]
    db.create_job(job_id, payload.topic, payload.language)  # topic already validated/stripped
    runner.enqueue(job_id)
    return {"id": job_id, "status": "queued"}


@app.get("/api/jobs", response_model=list[JobOut])
async def list_jobs():
    return [_to_out(j) for j in db.list_jobs()]


@app.get("/api/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: str):
    job = db.get_job(job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    return _to_out(job)


@app.get("/api/jobs/{job_id}/video")
async def get_video(job_id: str):
    path = runner.video_path(job_id)
    if not path.exists():
        raise HTTPException(404, "video not ready")
    return FileResponse(path, media_type="video/mp4", filename=f"short_{job_id}.mp4")


@app.delete("/api/jobs/{job_id}", status_code=204)
async def delete_job(job_id: str):
    job = db.get_job(job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    # Only terminal jobs are deletable. This covers the running job and any
    # still queued in memory, so a delete can't remove a row whose id the worker
    # will later dequeue, nor a job mid-render.
    if job["status"] not in db.TERMINAL_STATUSES:
        raise HTTPException(409, "job is still processing")
    db.delete_job(job_id)
    shutil.rmtree(runner.job_dir(job_id), ignore_errors=True)


app.mount("/", StaticFiles(directory=str(config.STATIC_DIR), html=True), name="static")
