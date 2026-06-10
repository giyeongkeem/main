"""ffmpeg rendering: per-segment normalization, concat, subtitle burn-in + mux.

All commands run with cwd=work_dir and relative filenames so the ass= filter
never needs path escaping. Inputs are arg lists, never shell strings.
"""

import asyncio
import json
from pathlib import Path

# Rotating palette for fallback backgrounds when no stock clip is available.
FALLBACK_COLORS = ["0x1a2a6c", "0xb21f1f", "0x1f6b3a", "0x4a148c", "0xb26a00", "0x00585e"]


class RenderError(RuntimeError):
    pass


async def _run(cmd: list[str], cwd: Path) -> None:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        tail = "\n".join(stderr.decode(errors="replace").splitlines()[-30:])
        raise RenderError(f"{cmd[0]} failed (exit {proc.returncode}):\n{tail}")


async def ffprobe_duration(path: Path) -> float:
    proc = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RenderError(f"ffprobe failed for {path.name}: {stderr.decode(errors='replace')[-500:]}")
    return float(json.loads(stdout)["format"]["duration"])


async def normalize_segment(work_dir: Path, raw_name: str, out_name: str, duration: float) -> None:
    """Pass A: loop/trim a raw clip to the narration duration at 1080x1920/30fps."""
    await _run(
        [
            "ffmpeg", "-y",
            "-stream_loop", "-1",
            "-i", raw_name,
            "-t", f"{duration:.3f}",
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,fps=30,setsar=1",
            "-an",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            out_name,
        ],
        work_dir,
    )


async def fallback_segment(work_dir: Path, out_name: str, duration: float, index: int) -> None:
    """Pass A fallback: solid-color background when no stock clip is available."""
    color = FALLBACK_COLORS[index % len(FALLBACK_COLORS)]
    await _run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"color=c={color}:s=1080x1920:r=30,format=yuv420p",
            "-t", f"{duration:.3f}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            out_name,
        ],
        work_dir,
    )


async def concat_video(work_dir: Path, segment_names: list[str], out_name: str) -> None:
    """Pass B (video): lossless concat — segments are uniform after Pass A."""
    list_file = work_dir / "vlist.txt"
    list_file.write_text("".join(f"file '{n}'\n" for n in segment_names))
    await _run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "vlist.txt", "-c", "copy", out_name],
        work_dir,
    )


async def concat_audio(work_dir: Path, audio_names: list[str], out_name: str) -> None:
    """Pass B (audio): transcode-concat narration mp3s to AAC."""
    list_file = work_dir / "alist.txt"
    list_file.write_text("".join(f"file '{n}'\n" for n in audio_names))
    await _run(
        [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", "alist.txt",
            "-c:a", "aac", "-b:a", "192k", out_name,
        ],
        work_dir,
    )


async def final_render(work_dir: Path, video_name: str, audio_name: str, ass_name: str, out_path: Path) -> None:
    """Pass C: burn ASS subtitles and mux narration into the final mp4."""
    await _run(
        [
            "ffmpeg", "-y",
            "-i", video_name,
            "-i", audio_name,
            "-vf", f"ass={ass_name}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "21",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart",
            str(out_path),
        ],
        work_dir,
    )
