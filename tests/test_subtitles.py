from app.pipeline.subtitles import (
    MAX_CHARS_PER_CHUNK,
    build_ass,
    build_captions,
    chunk_words,
    escape_ass_text,
    extend_caption_ends,
    format_ass_time,
    ticks_to_seconds,
    Caption,
)


def test_ticks_to_seconds():
    assert ticks_to_seconds(10_000_000) == 1.0
    assert ticks_to_seconds(2_500_000) == 0.25


def test_format_ass_time():
    assert format_ass_time(0) == "0:00:00.00"
    assert format_ass_time(1.234) == "0:00:01.23"
    assert format_ass_time(61.5) == "0:01:01.50"
    assert format_ass_time(3661.999) == "1:01:02.00"
    assert format_ass_time(-1) == "0:00:00.00"


def test_escape_ass_text():
    assert escape_ass_text("a{b}c") == "a(b)c"
    assert escape_ass_text("x\ny") == "x y"


def test_chunk_words_by_count():
    words = [(i * 1.0, i * 1.0 + 0.5, "ab") for i in range(7)]
    chunks = chunk_words(words)
    assert [len(c.text.split()) for c in chunks] == [3, 3, 1]
    assert chunks[0].start == 0.0
    assert chunks[0].end == 2.5


def test_chunk_words_by_chars_korean():
    # Long Korean-ish words should break by character budget before word count
    words = [(0.0, 0.5, "어어어어어어어"), (0.5, 1.0, "이이이이이이이"), (1.0, 1.5, "오오")]
    chunks = chunk_words(words)
    # 7+7 chars exceeds the 14-char budget, so the first word stands alone;
    # 7+2 fits, so the last two words share a chunk.
    assert [c.text for c in chunks] == ["어어어어어어어", "이이이이이이이 오오"]


def test_chunk_words_char_budget_matches_rendered_width():
    # A caption's rendered length ("w0 w1 ...") must never exceed the budget.
    words = [(0.0, 0.5, "a" * 13), (0.5, 1.0, "b"), (1.0, 1.5, "c")]
    chunks = chunk_words(words)
    for c in chunks:
        assert len(c.text) <= MAX_CHARS_PER_CHUNK
    # 13 + 1(space) + 1 = 15 > 14, so the 1-char word starts a new chunk.
    assert chunks[0].text == "a" * 13


def test_extend_caption_ends():
    caps = [Caption(0.0, 0.8, "a"), Caption(1.0, 1.5, "b")]
    out = extend_caption_ends(caps)
    assert out[0].end == 1.0  # extended to next start
    assert out[1].end == 1.5  # last caption keeps its own end


def test_build_captions_respect_segment_boundaries():
    # Two segments — captions must not merge words across the boundary
    seg1 = ([(0.0, 0.4, "a"), (0.5, 0.9, "b")], 1.0)
    seg2 = ([(0.0, 0.3, "c")], 0.8)
    caps = build_captions([seg1, seg2])
    assert [c.text for c in caps] == ["a b", "c"]
    # Last caption of seg1 is held until the segment ends (the video cut)
    assert caps[0].end == 1.0
    # seg2 caption is offset by seg1's probed duration
    assert caps[1].start == 1.0
    assert caps[1].end == 1.8


def test_build_ass_document():
    from app import config

    seg = ([(0.0, 0.5, "hello"), (0.5, 1.0, "world")], 1.2)
    doc = build_ass([seg])
    assert "PlayResX: 1080" in doc
    assert "PlayResY: 1920" in doc
    assert config.SUBTITLE_FONT in doc  # platform-appropriate CJK font
    assert "Dialogue: 0,0:00:00.00," in doc
    assert "hello world" in doc
