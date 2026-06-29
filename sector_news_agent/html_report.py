"""Markdown 리포트를 시각적으로 보기 좋은 자체 완결 HTML로 변환한다.

의존성: markdown (requirements.txt). 표/펜스코드 확장 사용.
"""

from __future__ import annotations

import markdown as _md

_TEMPLATE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  :root{{
    --bg:#0f1419; --panel:#161c24; --panel2:#1c2530; --line:#27313d;
    --ink:#e8eef5; --muted:#9aa7b5; --dim:#6b7886; --accent:#7c9cff;
    --up:#3ddc84; --down:#ff6b6b;
  }}
  *{{box-sizing:border-box}}
  body{{margin:0; background:linear-gradient(180deg,#0c1116,#0f1419 240px); color:var(--ink);
    font-family:-apple-system,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif;
    line-height:1.75; -webkit-font-smoothing:antialiased;}}
  .wrap{{max-width:880px; margin:0 auto; padding:40px 22px 80px}}
  .disclaimer{{font-size:12px; color:var(--dim); background:var(--panel); border:1px solid var(--line);
    border-radius:8px; padding:8px 12px; display:inline-block; margin-bottom:28px}}
  h1{{font-size:30px; letter-spacing:-.02em; margin:0 0 6px; border-bottom:1px solid var(--line); padding-bottom:16px}}
  h2{{font-size:13px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted);
    border-left:3px solid var(--accent); padding-left:10px; margin:38px 0 14px}}
  h3{{font-size:18px; margin:22px 0 6px}}
  p{{margin:10px 0}}
  ul{{padding-left:20px}} li{{margin:6px 0}}
  strong{{color:#fff}}
  a{{color:var(--accent); text-decoration:none; border-bottom:1px solid rgba(124,156,255,.3)}}
  a:hover{{border-bottom-color:var(--accent)}}
  hr{{border:0; border-top:1px solid var(--line); margin:24px 0}}
  table{{width:100%; border-collapse:collapse; font-size:14px; background:var(--panel);
    border:1px solid var(--line); border-radius:12px; overflow:hidden; margin:14px 0}}
  th,td{{padding:11px 14px; text-align:left; border-bottom:1px solid var(--line); vertical-align:top}}
  th{{background:var(--panel2); color:var(--muted); font-size:12px; font-weight:700}}
  tr:last-child td{{border-bottom:0}}
  td:first-child{{font-weight:700; color:#fff}}
  blockquote{{margin:16px 0; padding:10px 16px; border-left:3px solid var(--accent);
    background:var(--panel); color:var(--muted); border-radius:0 8px 8px 0}}
  code{{background:var(--panel2); padding:2px 6px; border-radius:4px; font-size:.9em}}
  @media print{{ body{{background:#fff; color:#111}} table,blockquote,.disclaimer{{background:#fff}} }}
</style>
</head>
<body>
<div class="wrap">
<div class="disclaimer">⚠️ 정보 제공 목적이며 투자 권유가 아닙니다.</div>
{body}
</div>
</body>
</html>
"""


def to_html(markdown_text: str, title: str = "데일리 섹터 리포트") -> str:
    """Markdown 텍스트를 스타일이 입혀진 완결 HTML 문서로 변환."""
    body = _md.markdown(
        markdown_text,
        extensions=["tables", "fenced_code", "sane_lists", "nl2br"],
    )
    return _TEMPLATE.format(title=title, body=body)
