"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StarIcon } from "./Icons";

export function ReviewForm({ listingId, defaultAuthor }: { listingId: string; defaultAuthor?: string }) {
  const router = useRouter();
  const [author, setAuthor] = useState(defaultAuthor ?? "");
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!text.trim()) {
      setError("후기 내용을 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: author.trim() || "익명", rating, text: text.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "후기 등록에 실패했습니다.");
      }
      setText("");
      setAuthor("");
      setRating(5);
      setDone(true);
      router.refresh();
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "후기 등록에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mb-5 p-5">
      <h3 className="font-bold text-ink">후기 작성</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {defaultAuthor ? (
          <span className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
            {defaultAuthor}님
          </span>
        ) : (
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="닉네임 (선택)"
            className="w-40 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        )}
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {Array.from({ length: 5 }).map((_, i) => {
            const v = i + 1;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setRating(v)}
                onMouseEnter={() => setHover(v)}
                aria-label={`${v}점`}
                className="text-amber-400"
              >
                <StarIcon width={22} height={22} filled={(hover || rating) >= v} />
              </button>
            );
          })}
          <span className="ml-1 text-sm font-semibold text-ink">{rating}.0</span>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="이용 경험을 솔직하게 남겨주세요."
        className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
      {done && <p className="mt-2 text-sm font-medium text-brand-700">후기가 등록되었습니다. 감사합니다!</p>}
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
          {busy ? "등록 중…" : "후기 등록"}
        </button>
      </div>
    </form>
  );
}
