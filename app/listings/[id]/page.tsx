import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categoryMeta, CATEGORY_LABEL } from "@/lib/data";
import { getById, getRelated } from "@/lib/store";
import { isAdmin } from "@/lib/admin-auth";
import { auth } from "@/lib/auth";
import type { Review } from "@/lib/types";
import { Gallery } from "@/components/Gallery";
import { ReviewForm } from "@/components/ReviewForm";
import { DeleteReviewButton } from "@/components/admin/AdminActions";
import { DetailSidebar } from "@/components/DetailSidebar";
import { ListingCard } from "@/components/ListingCard";
import { RatingStars } from "@/components/RatingStars";
import {
  BadgeCheckIcon,
  CategoryIcon,
  CheckIcon,
  ChevronRightIcon,
  MapPinIcon,
} from "@/components/Icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getById(id);
  if (!listing) return { title: "찾을 수 없음" };
  return {
    title: `${listing.name} — ${CATEGORY_LABEL[listing.type]}`,
    description: `${listing.district} ${listing.neighborhood} · ${listing.tagline}. 평점 ${listing.rating.toFixed(1)}, 후기 ${listing.reviewCount}개.`,
  };
}

export default async function DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getById(id);
  if (!listing || listing.status === "pending") notFound();

  const admin = await isAdmin();
  const session = await auth();
  const meta = categoryMeta(listing.type);
  const related = await getRelated(listing, 3);
  const dist = ratingDistribution(listing.reviews);

  return (
    <div className="container-page py-8">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-brand-700">홈</Link>
        <ChevronRightIcon width={14} height={14} />
        <Link href={`/listings?type=${listing.type}`} className="hover:text-brand-700">
          {CATEGORY_LABEL[listing.type]}
        </Link>
        <ChevronRightIcon width={14} height={14} />
        <span className="truncate font-medium text-ink-soft">{listing.name}</span>
      </nav>

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
        <div>
          {/* Header */}
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                <CategoryIcon name={meta.icon} width={14} height={14} />
                {CATEGORY_LABEL[listing.type]}
              </span>
              {listing.certifications.some((c) => c.verified) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                  <BadgeCheckIcon width={14} height={14} /> 자격증 인증
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink">{listing.name}</h1>
            <p className="mt-1.5 text-lg text-ink-soft">{listing.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <RatingStars value={listing.rating} size={16} showValue count={listing.reviewCount} />
              <span className="flex items-center gap-1 text-ink-muted">
                <MapPinIcon width={15} height={15} /> {listing.address}
              </span>
            </div>
          </header>

          {/* Gallery */}
          <div className="mt-6">
            <Gallery photos={listing.photos} icon={meta.icon} />
          </div>

          {/* 사이드바(모바일에서는 갤러리 아래로) */}
          <div className="mt-6 lg:hidden">
            <DetailSidebar listing={listing} />
          </div>

          {/* 소개 */}
          <Section title="소개">
            <p className="leading-relaxed text-ink-soft">{listing.description}</p>
          </Section>

          {/* 자격증 */}
          <Section title="자격증 및 인증">
            <ul className="space-y-3">
              {listing.certifications.map((c, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-semibold text-ink">{c.name}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">{c.issuer} · {c.year}년 취득</p>
                  </div>
                  {c.verified ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                      <BadgeCheckIcon width={14} height={14} /> 인증 완료
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-muted">
                      미인증
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              ‘인증 완료’는 발급기관 정보와 대조해 확인된 자격증입니다. (데모 표기)
            </p>
          </Section>

          {/* 전문 분야 */}
          <Section title="전문 분야">
            <div className="flex flex-wrap gap-2">
              {listing.specialties.map((s) => (
                <span key={s} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-ink-soft">
                  #{s}
                </span>
              ))}
            </div>
          </Section>

          {/* 시설·편의 */}
          <Section title="시설 및 편의사항">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {listing.amenities.map((a) => (
                <div key={a} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-ink-soft">
                  <CheckIcon width={16} height={16} className="text-brand-600" /> {a}
                </div>
              ))}
            </div>
          </Section>

          {/* 후기 */}
          <Section title={`이용 후기 (${listing.reviewCount.toLocaleString()})`}>
            <div className="card mb-5 flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
              <div className="text-center sm:w-40 sm:shrink-0 sm:border-r sm:border-slate-100">
                <div className="text-4xl font-extrabold text-ink">{listing.rating.toFixed(1)}</div>
                <RatingStars value={listing.rating} size={16} className="mt-1 justify-center" />
                <p className="mt-1 text-xs text-ink-muted">{listing.reviewCount.toLocaleString()}개 후기</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {dist.map((d) => (
                  <div key={d.star} className="flex items-center gap-2 text-xs">
                    <span className="w-7 text-ink-muted">{d.star}점</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-ink-muted">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <ReviewForm listingId={listing.id} defaultAuthor={session?.user?.name ?? undefined} />

            {listing.reviews.length === 0 && (
              <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-ink-muted">
                아직 후기가 없습니다. 첫 후기를 남겨보세요!
              </p>
            )}
            <ul className="space-y-4">
              {listing.reviews.map((r) => (
                <li key={r.id} className="card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                        {r.author.charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">{r.author}</p>
                        <RatingStars value={r.rating} size={13} />
                      </div>
                    </div>
                    <span className="text-xs text-ink-muted">{r.date}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{r.text}</p>
                  {r.tags && r.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-ink-muted">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {admin && (
                    <div className="mt-3 border-t border-slate-100 pt-2 text-right">
                      <DeleteReviewButton listingId={listing.id} reviewId={r.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* 데스크톱 사이드바 */}
        <aside className="hidden lg:block">
          <DetailSidebar listing={listing} />
        </aside>
      </div>

      {/* 관련 추천 */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            비슷한 {CATEGORY_LABEL[listing.type]}
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-slate-100 pt-8">
      <h2 className="mb-4 text-xl font-extrabold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

function ratingDistribution(reviews: Review[]) {
  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    const s = Math.round(r.rating);
    counts[s] = (counts[s] ?? 0) + 1;
  });
  const total = reviews.length || 1;
  return [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: counts[star],
    pct: Math.round((counts[star] / total) * 100),
  }));
}
