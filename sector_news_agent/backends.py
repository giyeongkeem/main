"""LLM 백엔드 추상화 — Claude API(웹검색 내장) 또는 로컬 Ollama.

각 백엔드는 complete(system, user, progress) -> str 을 제공한다.
- ClaudeBackend: 서버사이드 web_search/web_fetch 도구 사용 (스스로 뉴스 수집)
- OllamaBackend: 로컬 모델 호출, 도구 없음 (뉴스는 news.py가 미리 수집해 전달)
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Callable

from .config import Config

ProgressFn = Callable[[str, str], None]

MAX_CONTINUATIONS = 6


class ClaudeBackend:
    """Claude API 백엔드. 자체 웹 검색으로 뉴스를 수집한다."""

    fetches_own_news = True

    def __init__(self, cfg: Config):
        import anthropic  # 로컬 백엔드만 쓸 때는 import 비용을 피함

        self.cfg = cfg
        self.client = anthropic.Anthropic()

    def complete(self, system: str, user: str, progress: ProgressFn, web_search: bool = False) -> str:
        tools = None
        if web_search:
            tools = [
                {"type": "web_search_20260209", "name": "web_search",
                 "max_uses": self.cfg.max_web_searches_per_sector},
                {"type": "web_fetch_20260209", "name": "web_fetch"},
            ]
        messages = [{"role": "user", "content": user}]
        for _ in range(MAX_CONTINUATIONS):
            kwargs: dict = dict(
                model=self.cfg.model,
                max_tokens=64000,
                system=system,
                thinking={"type": "adaptive"},
                output_config={"effort": self.cfg.effort},
                messages=messages,
            )
            if tools:
                kwargs["tools"] = tools
            with self.client.messages.stream(**kwargs) as stream:
                for event in stream:
                    if event.type == "content_block_start" and event.content_block.type == "server_tool_use":
                        progress("tool", f"[도구 실행: {event.content_block.name}]")
                    elif event.type == "content_block_delta" and event.delta.type == "text_delta":
                        progress("text", event.delta.text)
                response = stream.get_final_message()
            if response.stop_reason == "refusal":
                raise RuntimeError("요청이 안전상의 이유로 거부되었습니다.")
            if response.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": response.content})
                continue
            return "\n".join(b.text for b in response.content if b.type == "text").strip()
        raise RuntimeError("pause_turn 반복 한도 초과로 중단했습니다.")


class OllamaBackend:
    """로컬 Ollama 백엔드. 무료지만 웹 검색이 없어 뉴스는 외부에서 주입받는다."""

    fetches_own_news = False

    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.url = f"{cfg.ollama_host}/api/chat"

    def complete(self, system: str, user: str, progress: ProgressFn, web_search: bool = False) -> str:
        # web_search 인자는 호환성을 위해 받되 무시한다 (로컬 모델은 도구 없음).
        payload = {
            "model": self.cfg.ollama_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": True,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.url, data=data, headers={"Content-Type": "application/json"}
        )
        parts: list[str] = []
        try:
            with urllib.request.urlopen(req, timeout=600) as resp:
                for line in resp:
                    line = line.strip()
                    if not line:
                        continue
                    obj = json.loads(line)
                    if "error" in obj:
                        raise RuntimeError(f"Ollama 오류: {obj['error']}")
                    chunk = obj.get("message", {}).get("content", "")
                    if chunk:
                        parts.append(chunk)
                        progress("text", chunk)
                    if obj.get("done"):
                        break
        except urllib.error.URLError as e:
            raise RuntimeError(
                f"Ollama 서버에 연결할 수 없습니다 ({self.url}). "
                f"'ollama serve'가 실행 중이고 모델 '{self.cfg.ollama_model}'이 설치되었는지 확인하세요. 원인: {e}"
            )
        return "".join(parts).strip()


def make_backend(cfg: Config):
    """config의 backend 설정에 따라 백엔드 인스턴스를 만든다."""
    if cfg.backend == "ollama":
        return OllamaBackend(cfg)
    return ClaudeBackend(cfg)
