from typing import Literal, Optional

from pydantic import BaseModel, Field


class Segment(BaseModel):
    text: str = Field(description="Narration text for this segment")
    search_keywords: list[str] = Field(
        description="1-3 short English keywords for stock video search"
    )


class ScriptResult(BaseModel):
    title: str = Field(description="Catchy YouTube Shorts title")
    description: str = Field(description="YouTube description, 1-3 sentences")
    tags: list[str] = Field(description="5-10 YouTube tags")
    hook: str = Field(description="The opening hook line (also segments[0].text)")
    segments: list[Segment] = Field(description="4-6 narration segments")


class JobCreate(BaseModel):
    topic: str = Field(min_length=1, max_length=300)
    language: Literal["ko", "en"] = "ko"
    voice: Optional[str] = None


class JobOut(BaseModel):
    id: str
    topic: str
    language: str
    status: str
    progress: int
    error: Optional[str] = None
    created_at: str
    has_video: bool = False
    metadata: Optional[dict] = None
