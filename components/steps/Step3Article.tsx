"use client";

import { useState } from "react";
import { useProject } from "@/store/useProject";

export default function Step3Article() {
  const { meta, summary, article, setArticle, updateCard, settings, setStep } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mock, setMock] = useState(false);
  const [cardCount, setCardCount] = useState(7);

  async function generate() {
    setLoading(true);
    setError("");
    setMock(false);
    try {
      const res = await fetch("/api/article", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meta, summary, cardCount, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "아티클 생성에 실패했습니다.");
      setArticle(data.article);
      setMock(!!data.mock);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card-panel flex flex-wrap items-end gap-3">
        <div>
          <label className="label">카드 수</label>
          <select className="field w-28" value={cardCount} onChange={(e) => setCardCount(Number(e.target.value))}>
            {[5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}장
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={generate} disabled={loading}>
          {loading ? "작성 중…" : article ? "다시 생성" : "아티클 생성"}
        </button>
        <p className="text-xs text-gray-500">요약 노트를 바탕으로 표지·본문·마무리 카드 텍스트를 작성합니다.</p>
      </div>

      {mock && (
        <p className="rounded-md bg-amber-500/15 px-3 py-2 text-xs text-amber-300">
          데모 데이터입니다. 설정(⚙️)에서 API 키를 입력하면 실제 AI가 카드 문구를 작성합니다.
        </p>
      )}
      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {article && (
        <div className="space-y-3">
          {article.cards.map((c, i) => (
            <div key={c.id} className="card-panel">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span className="rounded bg-white/10 px-2 py-0.5">{c.kind}</span>
                <span>카드 {i + 1}</span>
              </div>
              <input
                className="field mb-2"
                value={c.eyebrow ?? ""}
                placeholder="라벨 (예: 01, 카테고리)"
                onChange={(e) => updateCard(c.id, { eyebrow: e.target.value })}
              />
              <input
                className="field mb-2 font-semibold"
                value={c.title ?? ""}
                placeholder="제목"
                onChange={(e) => updateCard(c.id, { title: e.target.value })}
              />
              <textarea
                className="field min-h-[72px] resize-none"
                value={c.body ?? ""}
                placeholder="본문"
                onChange={(e) => updateCard(c.id, { body: e.target.value })}
              />
            </div>
          ))}

          <div className="card-panel">
            <label className="label">인스타 캡션 / 해시태그</label>
            <textarea
              className="field min-h-[90px] resize-none"
              value={article.caption ?? ""}
              onChange={(e) => setArticle({ ...article, caption: e.target.value })}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={() => setStep(1)}>
          ← 이전
        </button>
        <button className="btn-primary" disabled={!article} onClick={() => setStep(3)}>
          다음: 카드 디자인 →
        </button>
      </div>
    </div>
  );
}
