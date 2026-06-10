"""Shorts script generation via the Claude API, with a fixture-based mock path."""

import json

from .. import config
from ..models import ScriptResult

PROMPTS = {
    "ko": (
        "당신은 유튜브 쇼츠 전문 작가입니다. 아래 주제로 60초 이내 쇼츠 내레이션 대본을 작성하세요.\n"
        "주제: {topic}\n\n"
        "요구사항:\n"
        "- 첫 세그먼트는 3초 안에 시청자를 붙잡는 강력한 훅이어야 합니다 (hook 필드와 동일).\n"
        "- 4~6개의 세그먼트, 내레이션 전체 합계는 약 340자 이내 (약 55초 분량).\n"
        "- 각 세그먼트의 search_keywords는 배경 스톡 영상 검색용으로 반드시 영어 단어 1~3개.\n"
        "- title은 한국어로 클릭을 유도하는 쇼츠 제목, description은 1~3문장, tags는 5~10개.\n"
        "- 문장은 짧고 구어체로, TTS로 읽기 자연스럽게 작성하세요."
    ),
    "en": (
        "You are a YouTube Shorts scriptwriter. Write a narration script for a short under 60 seconds.\n"
        "Topic: {topic}\n\n"
        "Requirements:\n"
        "- The first segment must be a strong hook that grabs viewers within 3 seconds (same as the hook field).\n"
        "- 4-6 segments, total narration under ~130 words (~55 seconds).\n"
        "- Each segment's search_keywords must be 1-3 short English words for stock-video search.\n"
        "- title is a click-worthy Shorts title, description is 1-3 sentences, tags are 5-10 items.\n"
        "- Keep sentences short and conversational so they read naturally as TTS."
    ),
}

MAX_SEGMENTS = 8


def _load_fixture(topic: str, language: str) -> ScriptResult:
    path = config.FIXTURES_DIR / f"sample_script_{language}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["title"] = data["title"].replace("{topic}", topic)
    data["description"] = data["description"].replace("{topic}", topic)
    return ScriptResult.model_validate(data)


async def generate_script(topic: str, language: str) -> ScriptResult:
    if config.MOCK_SCRIPT or not config.ANTHROPIC_API_KEY:
        return _load_fixture(topic, language)

    from anthropic import AsyncAnthropic

    client = AsyncAnthropic()
    response = await client.messages.parse(
        model=config.SHORTS_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": PROMPTS[language].format(topic=topic)}],
        output_format=ScriptResult,
    )
    script = response.parsed_output
    if script is None or not script.segments:
        raise RuntimeError("Script generation returned no segments")
    script.segments = script.segments[:MAX_SEGMENTS]
    return script
