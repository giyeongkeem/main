import os
import shutil
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
SHORTS_MODEL = os.environ.get("SHORTS_MODEL", "claude-opus-4-8")
MOCK_SCRIPT = os.environ.get("MOCK_SCRIPT", "") == "1"
MOCK_TTS = os.environ.get("MOCK_TTS", "") == "1"

VOICES = {
    "ko": "ko-KR-SunHiNeural",
    "en": "en-US-AriaNeural",
}


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def health() -> dict:
    return {
        "ffmpeg": ffmpeg_available(),
        "anthropic_key": bool(ANTHROPIC_API_KEY),
        "pexels_key": bool(PEXELS_API_KEY),
        "mock_script": MOCK_SCRIPT or not ANTHROPIC_API_KEY,
        "mock_tts": MOCK_TTS,
    }
