"""Job queue worker: runs the full pipeline for one job at a time (FIFO)."""

import asyncio
import json
import shutil
import traceback
from pathlib import Path
from typing import Optional

import httpx

from .. import config, db
from . import render, subtitles, tts, visuals
from .script import generate_script

queue: asyncio.Queue = asyncio.Queue()
current_job_id: Optional[str] = None


def job_dir(job_id: str) -> Path:
    return config.OUTPUT_DIR / job_id


def video_path(job_id: str) -> Path:
    return job_dir(job_id) / "short.mp4"


async def worker() -> None:
    while True:
        job_id = await queue.get()
        global current_job_id
        current_job_id = job_id
        try:
            await run_pipeline(job_id)
        except Exception as exc:  # noqa: BLE001 — job failures must not kill the worker
            detail = f"{exc}\n{traceback.format_exc(limit=3)}"
            db.update_job(job_id, status="failed", error=str(exc)[:2000])
            print(f"[job {job_id}] failed: {detail}")
        finally:
            current_job_id = None
            queue.task_done()


async def run_pipeline(job_id: str) -> None:
    job = db.get_job(job_id)
    if job is None:
        return
    if not config.ffmpeg_available():
        raise RuntimeError("ffmpeg/ffprobe not found — install with: brew install ffmpeg")

    out_dir = job_dir(job_id)
    work = out_dir / "work"
    work.mkdir(parents=True, exist_ok=True)
    voice = job["voice"] or config.VOICES[job["language"]]

    # 1. Script
    db.update_job(job_id, status="generating_script", progress=5)
    script = await generate_script(job["topic"], job["language"])
    metadata = {
        "title": script.title,
        "description": script.description,
        "tags": script.tags,
        "hook": script.hook,
    }
    db.update_job(job_id, metadata=metadata)
    (out_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 2. TTS
    db.update_job(job_id, status="generating_audio", progress=25)
    texts = [seg.text for seg in script.segments]
    tts_results = await tts.synthesize_all(texts, voice, work)

    # 3. Background clips
    db.update_job(job_id, status="fetching_video", progress=30)
    n = len(script.segments)
    seg_names: list[str] = []
    used_ids: set[int] = set()
    async with httpx.AsyncClient(follow_redirects=True) as client:
        for i, seg in enumerate(script.segments):
            raw = work / f"raw_{i}.mp4"
            out_name = f"seg_{i}.mp4"
            duration = tts_results[i][2]
            ok = await visuals.fetch_segment_clip(client, seg.search_keywords, raw, used_ids)
            if ok:
                try:
                    await render.normalize_segment(work, raw.name, out_name, duration)
                except render.RenderError:
                    await render.fallback_segment(work, out_name, duration, i)
            else:
                await render.fallback_segment(work, out_name, duration, i)
            seg_names.append(out_name)
            db.update_job(job_id, progress=30 + int(25 * (i + 1) / n))

    # 4. Subtitles
    db.update_job(job_id, status="building_subtitles", progress=65)
    ass_doc = subtitles.build_ass([(words, dur) for _, words, dur in tts_results])
    (work / "subs.ass").write_text(ass_doc, encoding="utf-8")

    # 5. Render
    db.update_job(job_id, status="rendering", progress=70)
    await render.concat_video(work, seg_names, "video_concat.mp4")
    await render.concat_audio(work, [p.name for p, _, _ in tts_results], "narration.m4a")
    db.update_job(job_id, progress=85)
    await render.final_render(work, "video_concat.mp4", "narration.m4a", "subs.ass", video_path(job_id))

    shutil.rmtree(work, ignore_errors=True)
    db.update_job(job_id, status="completed", progress=100)


def enqueue(job_id: str) -> None:
    queue.put_nowait(job_id)
