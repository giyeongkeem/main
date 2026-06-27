"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompare } from "./CompareContext";
import { getListing, categoryMeta } from "@/lib/data";
import { FacilityImage } from "./FacilityImage";
import { ArrowRightIcon, XIcon } from "./Icons";

export function CompareBar() {
  const { ids, remove, clear, max } = useCompare();
  const pathname = usePathname();

  if (ids.length === 0 || pathname === "/compare") return null;

  const items = ids.map((id) => getListing(id)).filter(Boolean);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 animate-fade-up px-3 pb-3 sm:px-6 sm:pb-5">
      <div className="container-page">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lift backdrop-blur-md">
          <div className="hidden shrink-0 text-sm font-bold text-ink sm:block">
            비교함 <span className="text-brand-600">{ids.length}</span>/{max}
          </div>

          <div className="flex flex-1 items-center gap-2 overflow-x-auto">
            {items.map((l) => {
              if (!l) return null;
              const meta = categoryMeta(l.type);
              return (
                <div
                  key={l.id}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1 pl-1 pr-2"
                >
                  <FacilityImage
                    tone={l.photos[0]?.tone ?? 0}
                    icon={meta.icon}
                    showLabel={false}
                    className="h-9 w-9 rounded-lg"
                  />
                  <span className="max-w-[120px] truncate text-sm font-medium text-ink">
                    {l.name}
                  </span>
                  <button
                    onClick={() => remove(l.id)}
                    className="grid h-5 w-5 place-items-center rounded-full text-ink-muted hover:bg-slate-200 hover:text-ink"
                    aria-label={`${l.name} 비교함에서 제거`}
                  >
                    <XIcon width={14} height={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={clear}
            className="hidden shrink-0 text-sm text-ink-muted hover:text-ink sm:block"
          >
            전체 삭제
          </button>
          <Link href="/compare" className="btn-primary shrink-0">
            비교하기
            <ArrowRightIcon width={18} height={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
