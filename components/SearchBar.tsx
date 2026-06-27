"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "./Icons";

export function SearchBar({ placeholder = "트레이너·센터·지역·전문분야를 검색해 보세요" }: { placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/listings?q=${encodeURIComponent(query)}` : "/listings");
  }

  return (
    <form onSubmit={submit} className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lift">
      <SearchIcon className="ml-2 shrink-0 text-ink-muted" width={22} height={22} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base outline-none placeholder:text-ink-muted"
      />
      <button type="submit" className="btn-primary shrink-0 px-5 py-2.5">
        검색
      </button>
    </form>
  );
}
