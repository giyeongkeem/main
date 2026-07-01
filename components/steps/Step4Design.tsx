"use client";

import { useCallback, useRef, useState } from "react";
import { useProject } from "@/store/useProject";
import { PALETTES, SIZES, TEMPLATES } from "@/lib/presets";
import { FONTS } from "@/lib/fonts";
import { fileToDataUrl } from "@/lib/imageClient";
import CardPreview, { type EditableField } from "@/components/CardPreview";
import type { CardKind, ImageMode } from "@/lib/types";

const KINDS: CardKind[] = ["cover", "content", "closing"];

export default function Step4Design() {
  const { article, design, meta, setDesign, updateCard, addCard, removeCard, moveCard, setStep } = useProject();
  const [sel, setSel] = useState(0);
  const [imgUrl, setImgUrl] = useState("");
  const [imgErr, setImgErr] = useState("");
  const [flash, setFlash] = useState<EditableField | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();
  const fieldRefs = {
    eyebrow: useRef<HTMLInputElement>(null),
    title: useRef<HTMLTextAreaElement>(null),
    body: useRef<HTMLTextAreaElement>(null),
    image: useRef<HTMLDivElement>(null),
  };

  // all hooks must run before the empty-state early return below
  const cards = article?.cards ?? [];
  const idx = Math.min(sel, Math.max(cards.length - 1, 0));
  const current = cards[idx];

  // ── click-to-edit bridge from the preview iframe ─────────────
  const onPreviewEdit = useCallback(
    (fieldName: EditableField, value: string) => {
      if (!current) return;
      if (fieldName !== "eyebrow" && fieldName !== "title" && fieldName !== "body") return;
      if ((current[fieldName] ?? "") === value) return;
      updateCard(current.id, { [fieldName]: value });
    },
    [current, updateCard]
  );

  const onPreviewFocus = useCallback(
    (fieldName: EditableField) => {
      const ref = fieldRefs[fieldName];
      ref?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(fieldName);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1200);
    },
    // refs are stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!article || !current) {
    return (
      <div className="card-panel mx-auto max-w-md text-center text-sm text-gray-400">
        아티클이 없습니다. 이전 단계에서 먼저 생성하세요.
      </div>
    );
  }

  const defaultMode = (): ImageMode => (current.kind === "cover" ? "background" : "top");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgErr("");
    try {
      const dataUrl = await fileToDataUrl(file);
      updateCard(current.id, { image: dataUrl, imageMode: current.imageMode || defaultMode() });
    } catch (err) {
      setImgErr((err as Error).message);
    }
  }

  function applyUrl() {
    const u = imgUrl.trim();
    if (!u) return;
    updateCard(current.id, { image: u, imageMode: current.imageMode || defaultMode() });
    setImgUrl("");
  }

  const flashCls = (f: EditableField) => (flash === f ? " ring-2 ring-blue-400" : "");

  return (
    <div className="space-y-4">
      {/* ── global design controls ─────────────────────────────── */}
      <div className="card-panel grid gap-4 md:grid-cols-3 xl:grid-cols-5">
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
          <div className="label">폰트</div>
          <label className="mb-0.5 block text-[11px] text-gray-500">제목</label>
          <select
            className="field mb-2"
            value={design.headingFont ?? "pretendard"}
            onChange={(e) => setDesign({ headingFont: e.target.value })}
          >
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.hint ? ` · ${f.hint}` : ""}
              </option>
            ))}
          </select>
          <label className="mb-0.5 block text-[11px] text-gray-500">본문</label>
          <select
            className="field"
            value={design.bodyFont ?? "pretendard"}
            onChange={(e) => setDesign({ bodyFont: e.target.value })}
          >
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.hint ? ` · ${f.hint}` : ""}
              </option>
            ))}
          </select>
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
            <CardPreview
              card={current}
              design={design}
              meta={meta}
              index={idx}
              total={cards.length}
              interactive
              onEdit={onPreviewEdit}
              onFocusField={onPreviewFocus}
            />
          </div>
          <div className="mt-2 text-center text-xs text-blue-300/80">
            💡 카드의 글자를 직접 클릭해서 바로 고칠 수 있어요
          </div>
          <div className="mt-2 flex justify-center gap-2 text-xs text-gray-400">
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
            <div className="flex overflow-hidden rounded-md border border-edge text-xs">
              {(["left", "center"] as const).map((a) => {
                const activeAlign = (current.align || (current.kind === "cover" ? "center" : "left")) === a;
                return (
                  <button
                    key={a}
                    onClick={() => updateCard(current.id, { align: a })}
                    className={`px-2.5 py-1 ${activeAlign ? "bg-blue-500 text-white" : "text-gray-300"}`}
                    title={a === "left" ? "왼쪽 정렬" : "가운데 정렬"}
                  >
                    {a === "left" ? "좌" : "중"}
                  </button>
                );
              })}
            </div>
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
            <input
              ref={fieldRefs.eyebrow}
              className={`field${flashCls("eyebrow")}`}
              value={current.eyebrow ?? ""}
              onChange={(e) => updateCard(current.id, { eyebrow: e.target.value })}
            />
          </div>
          <div>
            <label className="label">제목</label>
            <textarea
              ref={fieldRefs.title}
              className={`field min-h-[60px] resize-none text-base font-semibold${flashCls("title")}`}
              value={current.title ?? ""}
              onChange={(e) => updateCard(current.id, { title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">본문</label>
            <textarea
              ref={fieldRefs.body}
              className={`field min-h-[160px] resize-none${flashCls("body")}`}
              value={current.body ?? ""}
              onChange={(e) => updateCard(current.id, { body: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500">빈 줄(엔터 2번)로 문단을 나눌 수 있어요.</p>
          </div>

          {/* ── image ─────────────────────────────────────────── */}
          <div ref={fieldRefs.image} className={`rounded-lg border-t border-edge pt-3${flashCls("image")}`}>
            <label className="label">이미지</label>
            {current.image ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={current.image} alt="" className="h-16 w-16 rounded-md object-cover" />
                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    {(["background", "top"] as ImageMode[]).map((m) => {
                      const activeMode = (current.imageMode || defaultMode()) === m;
                      return (
                        <button
                          key={m}
                          onClick={() => updateCard(current.id, { imageMode: m })}
                          className={`btn-sm rounded-md border px-2 py-1 ${
                            activeMode ? "border-blue-500 bg-blue-500/15 text-white" : "border-edge text-gray-300"
                          }`}
                        >
                          {m === "background" ? "배경" : "상단"}
                        </button>
                      );
                    })}
                    <label className="btn-ghost btn-sm cursor-pointer">
                      교체
                      <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                    </label>
                    <button className="btn-ghost btn-sm text-red-400" onClick={() => updateCard(current.id, { image: undefined })}>
                      제거
                    </button>
                  </div>
                </div>
                {(current.imageMode || defaultMode()) === "background" && (
                  <label className="block text-xs text-gray-400">
                    배경 어둡기 {Math.round((current.imageOverlay ?? 0.5) * 100)}%
                    <input
                      type="range"
                      min={0}
                      max={0.9}
                      step={0.05}
                      value={current.imageOverlay ?? 0.5}
                      onChange={(e) => updateCard(current.id, { imageOverlay: Number(e.target.value) })}
                      className="w-full accent-blue-500"
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn-ghost btn-sm cursor-pointer">
                  📁 파일 업로드
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
                <input
                  className="field flex-1"
                  placeholder="또는 이미지 URL 붙여넣기"
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyUrl()}
                />
                <button className="btn-ghost btn-sm" onClick={applyUrl}>
                  적용
                </button>
              </div>
            )}
            {imgErr && <p className="mt-1 text-xs text-red-400">⚠️ {imgErr}</p>}
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
