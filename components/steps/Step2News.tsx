"use client";

import { useState } from "react";
import { useProject } from "@/store/useProject";
import type { NewsItem } from "@/lib/types";

export default function Step2News() {
  const { meta, feeds, news, setNews, toggleNews, patchNews, summary, setSummary, settings, setStep } = useProject();
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState("");
  const [mock, setMock] = useState(false);

  const selected = news.filter((n) => n.selected);

  async function fetchNews() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/news", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: meta.topic, feeds: feeds.filter((f) => f.enabled && f.url) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "뉴스를 가져오지 못했습니다.");
      // preserve selection state on refetch
      const prev = new Map(news.map((n) => [n.link, n.selected]));
      setNews((data.items as NewsItem[]).map((n) => ({ ...n, selected: prev.get(n.link) ?? false })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function summarize() {
    if (selected.length === 0) return;
    setSummarizing(true);
    setError("");
    setMock(false);
    try {
      // best-effort full-text fetch for selected items missing content
      await Promise.all(
        selected
          .filter((it) => !it.content && it.link)
          .map(async (it) => {
            try {
              const r = await fetch("/api/extract", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ url: it.link }),
              });
              const d = await r.json();
              if (d.text) patchNews(it.id, { content: d.text });
            } catch {
              /* ignore — snippet is enough */
            }
          })
      );
      const withContent = useProject.getState().news.filter((n) => n.selected);
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: meta.topic, items: withContent, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요약에 실패했습니다.");
      setSummary(data.summary);
      setMock(!!data.mock);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      {/* news list */}
      <div className="card-panel">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">최신 뉴스</h3>
          <button className="btn-primary btn-sm" onClick={fetchNews} disabled={loading}>
            {loading ? "검색 중…" : news.length ? "새로고침" : "뉴스 가져오기"}
          </button>
        </div>

        {news.length === 0 && !loading && (
          <p className="py-10 text-center text-sm text-gray-500">
            “{meta.topic}” 관련 최신 뉴스를 검색합니다.
            <br />
            위 버튼을 눌러 시작하세요.
          </p>
        )}

        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {news.map((it) => (
            <label
              key={it.id}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                it.selected ? "border-blue-500/60 bg-blue-500/10" : "border-edge hover:bg-white/5"
              }`}
            >
              <input
                type="checkbox"
                checked={!!it.selected}
                onChange={() => toggleNews(it.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-blue-500"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-snug">{it.title}</div>
                {it.snippet && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{it.snippet}</p>}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                  <span>{it.source}</span>
                  {it.published && <span>· {new Date(it.published).toLocaleDateString("ko-KR")}</span>}
                  <a
                    href={it.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-400 hover:underline"
                  >
                    원문↗
                  </a>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* summary */}
      <div className="card-panel flex flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">요약 노트</h3>
          <button className="btn-primary btn-sm" onClick={summarize} disabled={summarizing || selected.length === 0}>
            {summarizing ? "요약 중…" : `선택 ${selected.length}개 요약`}
          </button>
        </div>
        {mock && (
          <p className="mb-2 rounded-md bg-amber-500/15 px-3 py-2 text-xs text-amber-300">
            데모 데이터입니다. 설정(⚙️)에서 API 키를 입력하면 실제 AI 요약이 생성됩니다.
          </p>
        )}
        <textarea
          className="field min-h-[44vh] flex-1 resize-none font-mono text-xs leading-relaxed"
          placeholder="선택한 기사를 요약하면 여기에 표시됩니다. 직접 수정할 수도 있어요."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-400 lg:col-span-2">⚠️ {error}</p>}

      <div className="flex justify-between lg:col-span-2">
        <button className="btn-ghost" onClick={() => setStep(0)}>
          ← 이전
        </button>
        <button className="btn-primary" disabled={!summary.trim()} onClick={() => setStep(2)}>
          다음: 아티클 작성 →
        </button>
      </div>
    </div>
  );
}
