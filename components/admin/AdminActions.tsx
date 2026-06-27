"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`‘${name}’ 항목을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("삭제에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
    >
      {busy ? "삭제 중…" : "삭제"}
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
