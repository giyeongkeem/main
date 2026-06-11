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
    return JobOut(
        id=job["id"],
        topic=job["topic"],
        language=job["language"],
        status=job["status"],
        progress=job["progress"],
        error=job["error"],
        created_at=job["created_at"],
        has_video=runner.video_path(job["id"]).exists(),
        metadata=job["metadata"],
    )


@app.get("/api/health")
async def health():
    return config.health()


@app.post("/api/jobs", status_code=201)
async def create_job(payload: JobCreate):
    job_id = uuid.uuid4().hex[:12]
    db.create_job(job_id, payload.topic.strip(), payload.language, payload.voice)
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


@app.get("/api/jobs/{job_id}/metadata")
async def get_metadata(job_id: str):
    path = runner.job_dir(job_id) / "metadata.json"
    if not path.exists():
        raise HTTPException(404, "metadata not ready")
    return FileResponse(path, media_type="application/json")


@app.delete("/api/jobs/{job_id}", status_code=204)
async def delete_job(job_id: str):
    job = db.get_job(job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    if job_id == runner.current_job_id:
        raise HTTPException(409, "job is currently running")
    db.delete_job(job_id)
    shutil.rmtree(runner.job_dir(job_id), ignore_errors=True)


app.mount("/", StaticFiles(directory=str(config.STATIC_DIR), html=True), name="static")
