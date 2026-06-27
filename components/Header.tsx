"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCompare } from "./CompareContext";
import { DumbbellIcon, ScaleIcon, SearchIcon } from "./Icons";

export function Header() {
  const router = useRouter();
  const { ids } = useCompare();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/listings?q=${encodeURIComponent(query)}` : "/listings");
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-soft">
            <DumbbellIcon width={20} height={20} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-ink">
            핏매치<span className="text-brand-600">.</span>
          </span>
          <span className="hidden text-xs font-medium text-ink-muted sm:inline">서울</span>
        </Link>

        <form onSubmit={submit} className="relative ml-2 hidden flex-1 md:block">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="트레이너·센터·지역·전문분야 검색"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Link href="/listings" className="btn-ghost px-3 py-2">전체 보기</Link>
          <Link
            href="/compare"
            className="btn-outline relative px-3 py-2"
            aria-label="비교함"
          >
            <ScaleIcon width={18} height={18} />
            비교함
            {ids.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                {ids.length}
              </span>
            )}
          </Link>
        </nav>

        {/* 모바일 비교함 + 메뉴 */}
        <div className="ml-auto flex items-center gap-2 md:hidden">
          <Link href="/compare" className="btn-outline relative px-3 py-2" aria-label="비교함">
            <ScaleIcon width={18} height={18} />
            {ids.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                {ids.length}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="btn-ghost px-3 py-2"
            aria-label="검색 열기"
          >
            <SearchIcon width={20} height={20} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white p-3 md:hidden">
          <form onSubmit={submit} className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="트레이너·센터·지역 검색"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm outline-none focus:border-brand-400 focus:bg-white"
            />
          </form>
        </div>
      )}
    </header>
  );
}
