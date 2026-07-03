import os
import shutil
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "output"
FIXTURES_DIR = BASE_DIR / "fixtures"
STATIC_DIR = BASE_DIR / "app" / "static"
DB_PATH = BASE_DIR / "jobs.db"

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")
SHORTS_MODEL = os.environ.get("SHORTS_MODEL", "claude-fable-5")
MOCK_SCRIPT = os.environ.get("MOCK_SCRIPT", "") == "1"
MOCK_TTS = os.environ.get("MOCK_TTS", "") == "1"
# When set, every request must authenticate (HTTP Basic, any username).
# Required when exposing the dashboard beyond localhost (LAN or public tunnel).
DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "")

# Hard ceiling on the finished video length (YouTube Shorts must stay <= 60s).
MAX_VIDEO_SECONDS = float(os.environ.get("MAX_VIDEO_SECONDS", "58"))

# Per-segment TTS timeout and per-ffmpeg-call timeout (seconds) — prevent a
# single stalled network/subprocess call from wedging the FIFO worker forever.
TTS_TIMEOUT = float(os.environ.get("TTS_TIMEOUT", "120"))
FFMPEG_TIMEOUT = float(os.environ.get("FFMPEG_TIMEOUT", "300"))

VOICES = {
    "ko": "ko-KR-SunHiNeural",
    "en": "en-US-AriaNeural",
}

# Subtitle font burned in by libass. macOS ships "Apple SD Gothic Neo" (covers
# Korean + Latin); on other platforms fall back to Noto Sans CJK, commonly
# available and CJK-capable. Override with SUBTITLE_FONT if needed.
_DEFAULT_FONT = "Apple SD Gothic Neo" if sys.platform == "darwin" else "Noto Sans CJK KR"
SUBTITLE_FONT = os.environ.get("SUBTITLE_FONT", _DEFAULT_FONT)


def use_mock_script() -> bool:
    """Single source of truth for whether the fixture script path is taken."""
    return MOCK_SCRIPT or not ANTHROPIC_API_KEY


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def health() -> dict:
    return {
        "ffmpeg": ffmpeg_available(),
        "anthropic_key": bool(ANTHROPIC_API_KEY),
        "pexels_key": bool(PEXELS_API_KEY),
        "mock_script": use_mock_script(),
        "mock_tts": MOCK_TTS,
    }

