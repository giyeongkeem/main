from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


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
    topic: str = Field(max_length=300)
    language: Literal["ko", "en"] = "ko"

    @field_validator("topic")
    @classmethod
    def _strip_nonempty(cls, v: str) -> str:
        # Strip before the emptiness check so whitespace-only topics are
        # rejected (a bare min_length runs against the pre-strip value).
        v = v.strip()
        if not v:
            raise ValueError("topic must not be empty")
        return v


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
