"""Pexels stock-video search and download with per-segment graceful fallback."""

from pathlib import Path
from typing import Optional

import httpx

from .. import config

PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search"


def _pick_file(video: dict) -> Optional[dict]:
    """Choose the smallest mp4 rendition with height >= 1920, else the largest."""
    files = [
        f for f in video.get("video_files", [])
        if f.get("file_type") == "video/mp4" and f.get("width") and f.get("height")
    ]
    if not files:
        return None
    tall = [f for f in files if f["height"] >= 1920]
    if tall:
        return min(tall, key=lambda f: f["height"])
    return max(files, key=lambda f: f["height"])


async def fetch_segment_clip(
    client: httpx.AsyncClient,
    keywords: list[str],
    dest: Path,
    used_ids: set[int],
) -> bool:
    """Download a portrait stock clip for one segment. Returns False on any failure."""
    if not config.PEXELS_API_KEY:
        return False
    query = " ".join(keywords) or "abstract background"
    try:
        resp = await client.get(
            PEXELS_SEARCH_URL,
            params={
                "query": query,
                "orientation": "portrait",
                "size": "medium",
                "per_page": 5,
            },
            headers={"Authorization": config.PEXELS_API_KEY},
            timeout=20,
        )
        resp.raise_for_status()
        for video in resp.json().get("videos", []):
            if video.get("height", 0) <= video.get("width", 0):
                continue
            if video.get("id") in used_ids:
                continue
            chosen = _pick_file(video)
            if not chosen:
                continue
            async with client.stream("GET", chosen["link"], timeout=120) as dl:
                dl.raise_for_status()
                with open(dest, "wb") as f:
                    async for chunk in dl.aiter_bytes(1 << 16):
                        f.write(chunk)
            used_ids.add(video["id"])
            return True
    except (httpx.HTTPError, OSError, ValueError):
        return False
    return False
