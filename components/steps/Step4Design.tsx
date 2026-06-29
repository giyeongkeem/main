"use client";

import { useState } from "react";
import { useProject } from "@/store/useProject";
import { PALETTES, SIZES, TEMPLATES } from "@/lib/presets";
import CardPreview from "@/components/CardPreview";
import type { CardKind } from "@/lib/types";

const KINDS: CardKind[] = ["cover", "content", "closing"];

export default function Step4Design() {
  const { article, design, meta, setDesign, updateCard, addCard, removeCard, moveCard, setStep } = useProject();
  const [sel, setSel] = useState(0);

  if (!article) {
    return (
      <div className="card-panel mx-auto max-w-md text-center text-sm text-gray-400">
        아티클이 없습니다. 이전 단계에서 먼저 생성하세요.
      </div>
    );
  }

  const cards = article.cards;
  const current = cards[Math.min(sel, cards.length - 1)];
  const idx = Math.min(sel, cards.length - 1);

  return (
    <div className="space-y-4">
      {/* ── global design controls ─────────────────────────────── */}
      <div className="card-panel grid gap-4 md:grid-cols-4">
        <div>
          <div className="label">템플릿</div>
          <div className="grid grid-cols-2 gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                title={t.hint}
                onClick={() => setDesign({ template: t.id })}
                className={`btn-sm rounded-md border px-2 py-1.5 text-xs ${
                  design.template === t.id ? "border-blue-500 bg-blue-500/15 text-white" : "border-edge text-gray-300"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">색상</div>
          <div className="flex flex-wrap gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                title={p.name}
                onClick={() => setDesign({ palette: p })}
                className={`h-8 w-8 rounded-full border-2 ${design.palette.id === p.id ? "border-white" : "border-transparent"}`}
                style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.accent} 50%)` }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="label">사이즈</div>
          <select
            className="field"
            value={design.size.id}
            onChange={(e) => setDesign({ size: SIZES.find((s) => s.id === e.target.value)! })}
          >
            {SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="mt-2 block text-xs text-gray-400">
            제목 크기 {Math.round(design.headingScale * 100)}%
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={design.headingScale}
              onChange={(e) => setDesign({ headingScale: Number(e.target.value) })}
              className="w-full accent-blue-500"
            />
          </label>
        </div>

        <div className="space-y-2 text-sm">
          <div className="label">표시 요소</div>
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={design.showHandle}
              onChange={(e) => setDesign({ showHandle: e.target.checked })}
              className="h-4 w-4 accent-blue-500"
            />
            핸들 ({meta.handle})
          </label>
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={design.showPageNumbers}
              onChange={(e) => setDesign({ showPageNumbers: e.target.checked })}
              className="h-4 w-4 accent-blue-500"
            />
            페이지 번호
          </label>
        </div>
      </div>

      {/* ── preview + editor ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[440px_1fr]">
        {/* preview column */}
        <div className="card-panel">
          <div className="mx-auto" style={{ maxWidth: 360 }}>
            <CardPreview card={current} design={design} meta={meta} index={idx} total={cards.length} />
          </div>
          <div className="mt-3 flex justify-center gap-2 text-xs text-gray-400">
            카드 {idx + 1} / {cards.length} · {current.kind}
          </div>

          {/* thumbnails */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {cards.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setSel(i)}
                className={`shrink-0 overflow-hidden rounded-md border-2 ${i === idx ? "border-blue-500" : "border-transparent"}`}
                style={{ width: 64 }}
              >
                <CardPreview card={c} design={design} meta={meta} index={i} total={cards.length} width={64} />
              </button>
            ))}
          </div>
        </div>

        {/* editor column */}
        <div className="card-panel space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="field w-32"
              value={current.kind}
              onChange={(e) => updateCard(current.id, { kind: e.target.value as CardKind })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-1.5">
              <button className="btn-ghost btn-sm" onClick={() => moveCard(current.id, -1)} disabled={idx === 0}>
                ↑
              </button>
              <button className="btn-ghost btn-sm" onClick={() => moveCard(current.id, 1)} disabled={idx === cards.length - 1}>
                ↓
              </button>
              <button className="btn-ghost btn-sm" onClick={() => addCard(current.id)}>
                + 추가
              </button>
              <button
                className="btn-ghost btn-sm text-red-400"
                onClick={() => {
                  removeCard(current.id);
                  setSel(Math.max(0, idx - 1));
                }}
                disabled={cards.length <= 1}
              >
                삭제
              </button>
            </div>
          </div>

          <div>
            <label className="label">라벨 (eyebrow)</label>
            <input className="field" value={current.eyebrow ?? ""} onChange={(e) => updateCard(current.id, { eyebrow: e.target.value })} />
          </div>
          <div>
            <label className="label">제목</label>
            <textarea
              className="field min-h-[60px] resize-none text-base font-semibold"
              value={current.title ?? ""}
              onChange={(e) => updateCard(current.id, { title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">본문</label>
            <textarea
              className="field min-h-[160px] resize-none"
              value={current.body ?? ""}
              onChange={(e) => updateCard(current.id, { body: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500">빈 줄(엔터 2번)로 문단을 나눌 수 있어요.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={() => setStep(2)}>
          ← 이전
        </button>
        <button className="btn-primary" onClick={() => setStep(4)}>
          다음: 내보내기 →
        </button>
      </div>
    </div>
  );
}
