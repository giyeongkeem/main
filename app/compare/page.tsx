"use client";

import Link from "next/link";
import { useCompare } from "@/components/CompareContext";
import {
  categoryMeta,
  CATEGORY_LABEL,
  getListing,
  verifiedCertCount,
} from "@/lib/data";
import type { Listing } from "@/lib/types";
import { FacilityImage } from "@/components/FacilityImage";
import { RatingStars } from "@/components/RatingStars";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckIcon,
  ScaleIcon,
  XIcon,
} from "@/components/Icons";

export default function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const items = ids.map((id) => getListing(id)).filter(Boolean) as Listing[];

  if (items.length === 0) {
    return (
      <div className="container-page py-20">
        <div className="card mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
            <ScaleIcon width={30} height={30} />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-ink">비교함이 비어 있어요</h1>
          <p className="mt-2 text-ink-muted">
            전문가 카드의 <span className="font-semibold text-brand-700">비교 담기</span> 버튼으로
            최대 3곳을 담아 나란히 비교해 보세요.
          </p>
          <Link href="/listings" className="btn-primary mt-6">
            전문가 둘러보기 <ArrowRightIcon width={18} height={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">비교하기</h1>
          <p className="mt-1 text-ink-muted">{items.length}곳을 항목별로 비교합니다.</p>
        </div>
        <button onClick={clear} className="btn-outline shrink-0">전체 비우기</button>
      </div>

      <div className="overflow-x-auto pb-2">
        <table className="w-full min-w-[640px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-32 bg-slate-50" />
              {items.map((l) => {
                const meta = categoryMeta(l.type);
                return (
                  <th key={l.id} className="w-1/3 p-2 align-top">
                    <div className="card overflow-hidden text-left">
                      <div className="relative">
                        <FacilityImage
                          tone={l.photos[0]?.tone ?? 0}
                          icon={meta.icon}
                          showLabel={false}
                          className="h-24 w-full"
                        />
                        <button
                          onClick={() => remove(l.id)}
                          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink-soft hover:text-ink"
                          aria-label={`${l.name} 제거`}
                        >
                          <XIcon width={15} height={15} />
                        </button>
                      </div>
                      <div className="p-3">
                        <Link href={`/listings/${l.id}`} className="line-clamp-1 font-bold text-ink hover:text-brand-700">
                          {l.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-muted">{CATEGORY_LABEL[l.type]}</p>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="text-sm">
            <Row label="평점">
              {items.map((l) => (
                <Cell key={l.id}>
                  <RatingStars value={l.rating} size={14} showValue />
                  <span className="block text-xs text-ink-muted">후기 {l.reviewCount.toLocaleString()}개</span>
                </Cell>
              ))}
            </Row>
            <Row label="가격">
              {items.map((l) => (
                <Cell key={l.id}>
                  <span className="font-bold text-ink">{l.priceLabel}</span>
                </Cell>
              ))}
            </Row>
            <Row label="경력">
              {items.map((l) => (
                <Cell key={l.id}>{l.experienceYears}년</Cell>
              ))}
            </Row>
            <Row label="지역">
              {items.map((l) => (
                <Cell key={l.id}>{l.district} {l.neighborhood}</Cell>
              ))}
            </Row>
            <Row label="자격증 인증">
              {items.map((l) => {
                const v = verifiedCertCount(l);
                return (
                  <Cell key={l.id}>
                    {v > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
                        <BadgeCheckIcon width={15} height={15} /> {v}개 인증
                      </span>
                    ) : (
                      <span className="text-ink-muted">정보 없음</span>
                    )}
                  </Cell>
                );
              })}
            </Row>
            <Row label="보유 자격증">
              {items.map((l) => (
                <Cell key={l.id}>
                  <ul className="space-y-1">
                    {l.certifications.map((c, i) => (
                      <li key={i} className="flex items-start gap-1 text-xs text-ink-soft">
                        {c.verified ? (
                          <BadgeCheckIcon width={13} height={13} className="mt-0.5 shrink-0 text-brand-600" />
                        ) : (
                          <span className="mt-0.5 h-3 w-3 shrink-0" />
                        )}
                        <span>{c.name}</span>
                      </li>
                    ))}
                  </ul>
                </Cell>
              ))}
            </Row>
            <Row label="전문 분야">
              {items.map((l) => (
                <Cell key={l.id}>
                  <div className="flex flex-wrap gap-1">
                    {l.specialties.map((s) => (
                      <span key={s} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-ink-soft">{s}</span>
                    ))}
                  </div>
                </Cell>
              ))}
            </Row>
            <Row label="시설·편의">
              {items.map((l) => (
                <Cell key={l.id}>
                  <ul className="space-y-1">
                    {l.amenities.map((a) => (
                      <li key={a} className="flex items-center gap-1 text-xs text-ink-soft">
                        <CheckIcon width={13} height={13} className="shrink-0 text-brand-600" /> {a}
                      </li>
                    ))}
                  </ul>
                </Cell>
              ))}
            </Row>
            <Row label="">
              {items.map((l) => (
                <Cell key={l.id}>
                  <Link href={`/listings/${l.id}`} className="btn-primary w-full">
                    상세 보기
                  </Link>
                </Cell>
              ))}
            </Row>
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <Link href="/listings" className="btn-outline">
          + 다른 전문가 더 담기
        </Link>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="sticky left-0 z-10 border-t border-slate-100 bg-slate-50 p-3 text-left align-top text-xs font-bold text-ink-soft">
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-t border-slate-100 p-3 align-top text-ink">{children}</td>
  );
}
