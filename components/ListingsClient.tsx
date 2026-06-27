"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  DISTRICTS,
  ALL_SPECIALTIES,
  hasVerifiedCert,
} from "@/lib/data";
import type { Listing, ListingType } from "@/lib/types";
import { ListingCard } from "./ListingCard";
import { BadgeCheckIcon, SlidersIcon, StarIcon, XIcon } from "./Icons";

const SORTS = [
  { value: "recommended", label: "추천순" },
  { value: "rating", label: "평점 높은순" },
  { value: "reviews", label: "후기 많은순" },
  { value: "price-asc", label: "가격 낮은순" },
  { value: "price-desc", label: "가격 높은순" },
  { value: "experience", label: "경력 많은순" },
];

export function ListingsClient({ listings }: { listings: Listing[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const readList = (key: string) =>
    searchParams
      .getAll(key)
      .flatMap((v) => v.split(","))
      .map((s) => s.trim())
      .filter(Boolean);

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [types, setTypes] = useState<string[]>(() => readList("type"));
  const [districts, setDistricts] = useState<string[]>(() => readList("district"));
  const [specialties, setSpecialties] = useState<string[]>(() => readList("specialty"));
  const [verifiedOnly, setVerifiedOnly] = useState(() => searchParams.get("verified") === "1");
  const [minRating, setMinRating] = useState(0);
  const [gender, setGender] = useState<"" | "남" | "여">("");
  const [sort, setSort] = useState("recommended");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 헤더 검색 등 외부 내비게이션으로 URL이 바뀌면 필터를 다시 반영
  const paramsKey = searchParams.toString();
  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setTypes(readList("type"));
    setDistricts(readList("district"));
    setSpecialties(readList("specialty"));
    setVerifiedOnly(searchParams.get("verified") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const toggle = (
    list: string[],
    setter: (v: string[]) => void,
    value: string
  ) => {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = listings.filter((l) => {
      if (types.length && !types.includes(l.type)) return false;
      if (districts.length && !districts.includes(l.district)) return false;
      if (verifiedOnly && !hasVerifiedCert(l)) return false;
      if (minRating && l.rating < minRating) return false;
      if (gender && l.gender !== gender) return false;
      if (specialties.length && !specialties.some((s) => l.specialties.includes(s)))
        return false;
      if (q) {
        const hay = [
          l.name,
          l.tagline,
          l.district,
          l.neighborhood,
          l.description,
          CATEGORY_LABEL[l.type],
          ...l.specialties,
          ...l.certifications.map((c) => c.name),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...result];
    switch (sort) {
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "reviews":
        sorted.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case "price-asc":
        sorted.sort((a, b) => a.priceValue - b.priceValue);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.priceValue - a.priceValue);
        break;
      case "experience":
        sorted.sort((a, b) => b.experienceYears - a.experienceYears);
        break;
      default:
        sorted.sort(
          (a, b) => Number(!!b.featured) - Number(!!a.featured) || b.rating - a.rating
        );
    }
    return sorted;
  }, [listings, query, types, districts, specialties, verifiedOnly, minRating, gender, sort]);

  const activeCount =
    types.length +
    districts.length +
    specialties.length +
    (verifiedOnly ? 1 : 0) +
    (minRating ? 1 : 0) +
    (gender ? 1 : 0) +
    (query ? 1 : 0);

  function resetAll() {
    setQuery("");
    setTypes([]);
    setDistricts([]);
    setSpecialties([]);
    setVerifiedOnly(false);
    setMinRating(0);
    setGender("");
    setSort("recommended");
    router.replace("/listings", { scroll: false });
  }

  const Filters = (
    <div className="space-y-7">
      <FilterSection title="카테고리">
        <div className="space-y-2">
          {CATEGORIES.map((c) => (
            <CheckRow
              key={c.type}
              checked={types.includes(c.type)}
              onChange={() => toggle(types, setTypes, c.type)}
              label={c.label}
              count={listings.filter((l) => l.type === (c.type as ListingType)).length}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="지역">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {DISTRICTS.map((d) => (
            <CheckRow
              key={d}
              checked={districts.includes(d)}
              onChange={() => toggle(districts, setDistricts, d)}
              label={d}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="자격증">
        <button
          onClick={() => setVerifiedOnly((v) => !v)}
          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
            verifiedOnly
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-white text-ink-soft hover:border-brand-300"
          }`}
        >
          <BadgeCheckIcon width={18} height={18} />
          자격증 인증된 곳만 보기
        </button>
      </FilterSection>

      <FilterSection title="최소 평점">
        <div className="flex flex-wrap gap-2">
          {[0, 4.5, 4.7, 4.8].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(r)}
              className={`chip ${minRating === r ? "chip-active" : ""}`}
            >
              {r === 0 ? "전체" : (
                <>
                  <StarIcon width={14} height={14} filled className="text-amber-400" /> {r}+
                </>
              )}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="트레이너 성별">
        <div className="flex gap-2">
          {[
            { v: "", l: "전체" },
            { v: "여", l: "여성" },
            { v: "남", l: "남성" },
          ].map((g) => (
            <button
              key={g.l}
              onClick={() => setGender(g.v as "" | "남" | "여")}
              className={`chip ${gender === g.v ? "chip-active" : ""}`}
            >
              {g.l}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">개인 트레이너에게만 적용됩니다.</p>
      </FilterSection>

      <FilterSection title="전문 분야">
        <div className="flex flex-wrap gap-2">
          {ALL_SPECIALTIES.map((s) => (
            <button
              key={s}
              onClick={() => toggle(specialties, setSpecialties, s)}
              className={`chip ${specialties.includes(s) ? "chip-active" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      </FilterSection>
    </div>
  );

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          전문가 둘러보기
        </h1>
        <p className="mt-1 text-ink-muted">
          조건을 선택해 나에게 맞는 피트니스·필라테스 전문가를 찾아보세요.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
        {/* 데스크톱 사이드바 */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">필터</h2>
              {activeCount > 0 && (
                <button onClick={resetAll} className="text-xs font-semibold text-brand-700 hover:underline">
                  초기화 ({activeCount})
                </button>
              )}
            </div>
            {Filters}
          </div>
        </aside>

        {/* 결과 영역 */}
        <div>
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              <span className="font-bold text-ink">{filtered.length}</span>개 결과
              {query && <span className="text-ink-muted"> · “{query}” 검색</span>}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className="btn-outline relative px-3 py-2 lg:hidden"
              >
                <SlidersIcon width={18} height={18} /> 필터
                {activeCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                    {activeCount}
                  </span>
                )}
              </button>
              <label className="sr-only" htmlFor="sort">정렬</label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm font-medium text-ink-soft outline-none focus:border-brand-400"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 활성 필터 칩 */}
          {activeCount > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {types.map((t) => (
                <ActiveChip key={t} label={CATEGORY_LABEL[t as ListingType]} onClear={() => toggle(types, setTypes, t)} />
              ))}
              {districts.map((d) => (
                <ActiveChip key={d} label={d} onClear={() => toggle(districts, setDistricts, d)} />
              ))}
              {specialties.map((s) => (
                <ActiveChip key={s} label={s} onClear={() => toggle(specialties, setSpecialties, s)} />
              ))}
              {gender && <ActiveChip label={`${gender === "여" ? "여성" : "남성"} 트레이너`} onClear={() => setGender("")} />}
              {minRating > 0 && <ActiveChip label={`평점 ${minRating}+`} onClear={() => setMinRating(0)} />}
              {verifiedOnly && <ActiveChip label="자격증 인증" onClear={() => setVerifiedOnly(false)} />}
              <button onClick={resetAll} className="text-xs font-semibold text-ink-muted underline hover:text-ink">
                모두 지우기
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState onReset={resetAll} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((l: Listing) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 모바일 필터 드로어 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-white shadow-lift animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="font-bold text-ink">필터 {activeCount > 0 && `(${activeCount})`}</h2>
              <button onClick={() => setDrawerOpen(false)} className="btn-ghost p-2">
                <XIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{Filters}</div>
            <div className="flex gap-2 border-t border-slate-200 p-4">
              <button onClick={resetAll} className="btn-outline flex-1">초기화</button>
              <button onClick={() => setDrawerOpen(false)} className="btn-primary flex-1">
                {filtered.length}개 결과 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
      />
      <span className="flex-1">{label}</span>
      {typeof count === "number" && <span className="text-xs text-ink-muted">{count}</span>}
    </label>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
      {label}
      <button onClick={onClear} className="grid h-4 w-4 place-items-center rounded-full hover:bg-brand-100" aria-label={`${label} 필터 제거`}>
        <XIcon width={12} height={12} />
      </button>
    </span>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-ink-muted">
        <SlidersIcon width={26} height={26} />
      </div>
      <h3 className="mt-4 text-lg font-bold text-ink">조건에 맞는 결과가 없어요</h3>
      <p className="mt-1 text-sm text-ink-muted">필터를 조정하거나 초기화해 보세요.</p>
      <button onClick={onReset} className="btn-primary mt-5">필터 초기화</button>
    </div>
  );
}
