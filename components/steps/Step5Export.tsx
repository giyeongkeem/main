"use client";

import { useState } from "react";
import { useProject } from "@/store/useProject";
import CardPreview from "@/components/CardPreview";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Step5Export() {
  const { article, design, meta, setStep } = useProject();
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  if (!article) {
    return <div className="card-panel mx-auto max-w-md text-center text-sm text-gray-400">아티클이 없습니다.</div>;
  }
  const cards = article.cards;

  async function render(single?: number) {
    setBusy(single === undefined ? "zip" : `one-${single}`);
    setError("");
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cards, design, meta, ...(single !== undefined ? { single } : {}) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `렌더링 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const base = (meta.topic || "cardnews").replace(/\s+/g, "-").slice(0, 30);
      downloadBlob(blob, single === undefined ? `${base}.zip` : `${base}-${String(single + 1).padStart(2, "0")}.png`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <div className="card-panel flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={() => render()} disabled={!!busy}>
          {busy === "zip" ? "PNG 생성 중…" : `전체 ${cards.length}장 PNG ZIP 다운로드`}
        </button>
        <span className="text-sm text-gray-400">
          {design.size.label} · 인스타 업로드용 고해상도 PNG
        </span>
        {error && <span className="text-sm text-red-400">⚠️ {error}</span>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div key={c.id} className="space-y-2">
            <CardPreview card={c} design={design} meta={meta} index={i} total={cards.length} />
            <button className="btn-ghost btn-sm w-full" onClick={() => render(i)} disabled={!!busy}>
              {busy === `one-${i}` ? "…" : `${String(i + 1).padStart(2, "0")} PNG`}
            </button>
          </div>
        ))}
      </div>

      {article.caption && (
        <div className="card-panel">
          <div className="mb-2 flex items-center justify-between">
            <div className="label mb-0">인스타 캡션</div>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(article.caption ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "복사됨 ✓" : "복사"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words text-sm text-gray-300">{article.caption}</pre>
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={() => setStep(3)}>
          ← 디자인으로
        </button>
        <span className="text-sm text-gray-500">완료! 수정이 필요하면 언제든 이전 단계로 돌아가세요.</span>
      </div>
    </div>
  );
}
