"""Pure functions converting word timings into a styled ASS subtitle document.

Word timings come from edge-tts WordBoundary events as (start_sec, end_sec, text)
tuples relative to the start of their own segment. Segment durations are the
ffprobe-measured mp3 lengths, which are authoritative for the global timeline.
"""

from dataclasses import dataclass

MAX_WORDS_PER_CHUNK = 3
MAX_CHARS_PER_CHUNK = 14

ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{fontname},88,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,560,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

DEFAULT_FONT = "Apple SD Gothic Neo"


@dataclass
class Caption:
    start: float
    end: float
    text: str


def ticks_to_seconds(ticks: int) -> float:
    """edge-tts WordBoundary offsets/durations are in 100-nanosecond ticks."""
    return ticks / 10_000_000


def format_ass_time(seconds: float) -> str:
    """ASS time format: h:mm:ss.cc (centiseconds)."""
    if seconds < 0:
        seconds = 0.0
    total_cs = round(seconds * 100)
    cs = total_cs % 100
    total_s = total_cs // 100
    s = total_s % 60
    m = (total_s // 60) % 60
    h = total_s // 3600
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def escape_ass_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


def chunk_words(words: list[tuple[float, float, str]]) -> list[Caption]:
    """Group word timings into short caption chunks (shorts-style)."""
    captions: list[Caption] = []
    cur: list[tuple[float, float, str]] = []
    cur_len = 0
    for w in words:
        wlen = len(w[2])
        if cur and (len(cur) >= MAX_WORDS_PER_CHUNK or cur_len + 1 + wlen > MAX_CHARS_PER_CHUNK):
            captions.append(Caption(cur[0][0], cur[-1][1], " ".join(x[2] for x in cur)))
            cur, cur_len = [], 0
        cur.append(w)
        cur_len += (1 if cur_len else 0) + wlen
    if cur:
        captions.append(Caption(cur[0][0], cur[-1][1], " ".join(x[2] for x in cur)))
    return captions


def extend_caption_ends(captions: list[Caption]) -> list[Caption]:
    """Extend each caption to the start of the next one to avoid flicker gaps."""
    out = []
    for i, c in enumerate(captions):
        end = captions[i + 1].start if i + 1 < len(captions) else c.end
        out.append(Caption(c.start, max(end, c.end), c.text))
    return out


def build_timeline(
    segments: list[tuple[list[tuple[float, float, str]], float]],
) -> list[tuple[float, float, str]]:
    """Offset each segment's word timings by the cumulative probed durations.

    segments: list of (words, probed_duration_seconds) per segment, in order.
    Returns a flat list of (start, end, text) on the global timeline.
    """
    timeline: list[tuple[float, float, str]] = []
    t0 = 0.0
    for words, duration in segments:
        for start, end, text in words:
            # Clamp word timings into their own segment window so trailing
            # padding differences never bleed into the next segment.
            s = min(start, duration)
            e = min(end, duration)
            timeline.append((t0 + s, t0 + e, text))
        t0 += duration
    return timeline


def build_captions(
    segments: list[tuple[list[tuple[float, float, str]], float]],
) -> list[Caption]:
    """Chunk each segment independently so captions never span a video cut.

    The last caption of each segment is held until the segment ends, covering
    the trailing audio padding instead of leaving a blank gap before the cut.
    """
    captions: list[Caption] = []
    t0 = 0.0
    for words, duration in segments:
        clamped = [(min(s, duration), min(e, duration), t) for s, e, t in words]
        seg_caps = extend_caption_ends(chunk_words(clamped))
        if seg_caps:
            last = seg_caps[-1]
            seg_caps[-1] = Caption(last.start, max(last.end, duration), last.text)
        captions.extend(Caption(t0 + c.start, t0 + c.end, c.text) for c in seg_caps)
        t0 += duration
    return captions


def build_ass(
    segments: list[tuple[list[tuple[float, float, str]], float]],
    fontname: str = DEFAULT_FONT,
) -> str:
    captions = build_captions(segments)
    lines = [ASS_HEADER.format(fontname=fontname)]
    for c in captions:
        lines.append(
            "Dialogue: 0,{start},{end},Default,,0,0,0,,{text}".format(
                start=format_ass_time(c.start),
                end=format_ass_time(c.end),
                text=escape_ass_text(c.text),
            )
        )
    return "\n".join(lines) + "\n"
