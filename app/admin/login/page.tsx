"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { DumbbellIcon, ShieldCheckIcon } from "@/components/Icons";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "로그인에 실패했습니다.");
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="card w-full max-w-sm p-7">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <DumbbellIcon width={20} height={20} />
          </span>
          <span className="text-lg font-extrabold text-ink">핏매치<span className="text-brand-600">.</span></span>
        </div>
        <h1 className="mt-5 flex items-center gap-2 text-xl font-extrabold text-ink">
          <ShieldCheckIcon width={20} height={20} className="text-brand-600" /> 관리자 로그인
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          전문가·센터 정보와 사진을 관리하려면 관리자 비밀번호를 입력하세요.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="관리자 비밀번호"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? "확인 중…" : "로그인"}
          </button>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          기본 비밀번호는 <code className="rounded bg-slate-100 px-1">admin1234</code> 입니다.
          실제 운영 시 환경변수 <code className="rounded bg-slate-100 px-1">ADMIN_PASSWORD</code> 로 변경하세요.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-brand-700 hover:underline">← 사이트로 돌아가기</Link>
      </div>
    </div>
  );
}
