"""Per-segment TTS via edge-tts, capturing WordBoundary events for subtitles.

Segment duration is measured with ffprobe on the produced mp3 — edge-tts audio
carries trailing padding the WordBoundary events don't cover, and that probed
value drives both video trimming and the cumulative subtitle timeline.
"""

import asyncio
from pathlib import Path

from .. import config
from .render import _run, ffprobe_duration
from .subtitles import ticks_to_seconds

# (start_sec, end_sec, text) relative to the segment start
WordTimings = list[tuple[float, float, str]]


async def synthesize_segment(text: str, voice: str, mp3_path: Path) -> tuple[WordTimings, float]:
    if config.MOCK_TTS:
        return await _mock_segment(text, mp3_path)

    import edge_tts

    words: WordTimings = []
    communicate = edge_tts.Communicate(text, voice)
    with open(mp3_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = ticks_to_seconds(chunk["offset"])
                end = ticks_to_seconds(chunk["offset"] + chunk["duration"])
                words.append((start, end, chunk["text"]))
    duration = await ffprobe_duration(mp3_path)
    return words, duration


async def _mock_segment(text: str, mp3_path: Path) -> tuple[WordTimings, float]:
    """Offline fallback: quiet tone audio sized to the text, even word spacing."""
    tokens = text.split()
    duration = max(1.0, len(text) * 0.06)
    await _run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"sine=frequency=220:duration={duration:.3f}",
            "-af", "volume=0.05",
            "-c:a", "libmp3lame", "-q:a", "5",
            mp3_path.name,
        ],
        mp3_path.parent,
    )
    words: WordTimings = []
    if tokens:
        step = duration / len(tokens)
        for i, tok in enumerate(tokens):
            words.append((i * step, min((i + 1) * step, duration), tok))
    probed = await ffprobe_duration(mp3_path)
    return words, probed


async def synthesize_all(texts: list[str], voice: str, work_dir: Path) -> list[tuple[Path, WordTimings, float]]:
    """Synthesize every segment sequentially; returns (mp3_path, words, duration) per segment."""
    results = []
    for i, text in enumerate(texts):
        mp3_path = work_dir / f"narration_{i}.mp3"
        words, duration = await synthesize_segment(text, voice, mp3_path)
        results.append((mp3_path, words, duration))
        await asyncio.sleep(0)  # yield to the event loop between segments
    return results
