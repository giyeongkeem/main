"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({
  id,
  name,
  label = "삭제",
  confirmText,
}: {
  id: string;
  name: string;
  label?: string;
  confirmText?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(confirmText ?? `‘${name}’ 항목을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("처리에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
    >
      {busy ? "처리 중…" : label}
    </button>
  );
}

export function ApproveButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onApprove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert(`‘${name}’ 승인에 실패했습니다.`);
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onApprove}
      disabled={busy}
      className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
    >
      {busy ? "처리 중…" : "승인"}
    </button>
  );
}

export function DeleteReviewButton({ listingId, reviewId }: { listingId: string; reviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("이 후기를 삭제할까요?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/reviews`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("후기 삭제에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-xs font-semibold text-ink-muted underline transition hover:text-red-600 disabled:opacity-50"
    >
      {busy ? "삭제 중…" : "관리자 삭제"}
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button onClick={onLogout} className="btn-ghost px-3 py-2 text-sm">
      로그아웃
    </button>
  );
}
