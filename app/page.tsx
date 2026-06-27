import Link from "next/link";
import { CATEGORIES, DISTRICTS } from "@/lib/data";
import { getAll, getFeatured, siteStats } from "@/lib/store";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CategoryIcon,
  ChevronRightIcon,
  MapPinIcon,
  ScaleIcon,
  ShieldCheckIcon,
  StarIcon,
  StudioIcon,
} from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const all = await getAll();
  const stats = await siteStats();
  const featured = await getFeatured(8);

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-100 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-emerald-50 blur-3xl" />
        <div className="container-page relative py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
              <ShieldCheckIcon width={14} height={14} /> 자격증·후기 검증 디렉터리
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              서울의 <span className="text-brand-600">검증된 전문가</span>를<br />
              한눈에 비교하고 선택하세요
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
              피트니스 · 퍼스널 트레이너 · 필라테스 트레이너 · 필라테스 센터의
              자격증 보유 여부, 실제 이용 후기, 시설 사진을 한 곳에서 확인하세요.
            </p>

            <div className="mx-auto mt-8 max-w-2xl">
              <SearchBar />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm text-ink-muted">인기 검색:</span>
              {CATEGORIES.map((c) => (
                <Link key={c.type} href={`/listings?type=${c.type}`} className="chip">
                  <CategoryIcon name={c.icon} width={15} height={15} />
                  {c.short}
                </Link>
              ))}
            </div>
          </div>

          {/* 신뢰 지표 */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat value={`${stats.total}+`} label="등록 전문가·센터" />
            <Stat value={`${stats.verified}`} label="자격증 인증" />
            <Stat value={stats.avgRating.toFixed(1)} label="평균 평점" />
            <Stat value={`${stats.reviews.toLocaleString()}+`} label="누적 이용 후기" />
          </div>
        </div>
      </section>

      {/* ───────── 카테고리 ───────── */}
      <section className="container-page py-16">
        <SectionHead
          eyebrow="카테고리"
          title="무엇을 찾고 계신가요?"
          desc="목적에 맞는 카테고리를 선택해 전문가와 센터를 둘러보세요."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => {
            const count = all.filter((l) => l.type === c.type).length;
            return (
              <Link
                key={c.type}
                href={`/listings?type=${c.type}`}
                className="card group flex flex-col p-6 transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  <CategoryIcon name={c.icon} width={24} height={24} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink">{c.label}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-muted">{c.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                  {count}곳 보기 <ChevronRightIcon width={16} height={16} className="transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ───────── 추천/인기 ───────── */}
      <section className="border-y border-slate-200 bg-white py-16">
        <div className="container-page">
          <div className="flex items-end justify-between gap-4">
            <SectionHead
              eyebrow="추천"
              title="평점 높은 인기 전문가"
              desc="이용자 평가가 높은 트레이너와 센터를 모았습니다."
            />
            <Link href="/listings" className="btn-outline hidden shrink-0 sm:inline-flex">
              전체 보기 <ArrowRightIcon width={18} height={18} />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Link href="/listings" className="btn-outline">
              전체 보기 <ArrowRightIcon width={18} height={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── 왜 핏매치 ───────── */}
      <section className="container-page py-16">
        <SectionHead
          eyebrow="왜 핏매치인가"
          title="후회 없는 선택을 위한 4가지 기준"
          desc="가입 유도나 광고가 아닌, 비교에 필요한 정보만 정직하게 보여드립니다."
          center
        />
        <div className="mx-auto mt-10 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<BadgeCheckIcon width={22} height={22} />}
            title="자격증 검증"
            desc="생활스포츠지도사, NSCA, STOTT 등 발급기관과 대조해 인증 배지를 표시합니다."
          />
          <Feature
            icon={<StarIcon width={22} height={22} filled />}
            title="실제 이용 후기"
            desc="별점과 함께 효과·청결·친절 등 항목별 후기를 솔직하게 제공합니다."
          />
          <Feature
            icon={<StudioIcon width={22} height={22} />}
            title="시설 사진"
            desc="기구·운동 공간·탈의실까지 방문 전에 시설을 미리 확인할 수 있습니다."
          />
          <Feature
            icon={<ScaleIcon width={22} height={22} />}
            title="한눈에 비교"
            desc="최대 3곳을 가격·평점·경력·자격증 기준으로 나란히 비교합니다."
          />
        </div>
      </section>

      {/* ───────── 지역 ───────── */}
      <section className="border-t border-slate-200 bg-white py-16">
        <div className="container-page">
          <SectionHead eyebrow="지역" title="자치구별로 찾기" desc="우리 동네 가까운 전문가를 찾아보세요." />
          <div className="mt-8 flex flex-wrap gap-2.5">
            {DISTRICTS.map((d) => (
              <Link key={d} href={`/listings?district=${encodeURIComponent(d)}`} className="chip">
                <MapPinIcon width={15} height={15} /> {d}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="container-page py-16">
        <div className="relative overflow-hidden rounded-2xl bg-brand-600 px-6 py-14 text-center shadow-lift sm:px-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-black/10 blur-2xl" />
          <h2 className="relative text-2xl font-extrabold text-white sm:text-3xl">
            지금 나에게 맞는 전문가를 찾아보세요
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-brand-50">
            지역·가격·자격증·전문분야로 필터링하고, 마음에 드는 곳을 비교함에 담아보세요.
          </p>
          <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/listings" className="btn bg-white px-6 py-3 text-brand-700 hover:bg-brand-50">
              전체 둘러보기 <ArrowRightIcon width={18} height={18} />
            </Link>
            <Link href="/listings?verified=1" className="btn border border-white/60 px-6 py-3 text-white hover:bg-white/10">
              자격증 인증 전문가만 보기
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-5 text-center shadow-soft">
      <div className="text-2xl font-extrabold text-brand-600 sm:text-3xl">{value}</div>
      <div className="mt-1 text-xs font-medium text-ink-muted sm:text-sm">{label}</div>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  desc,
  center,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="label-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {desc && <p className="mt-2 text-ink-muted">{desc}</p>}
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card p-6">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
        {icon}
      </span>
      <h3 className="mt-4 font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{desc}</p>
    </div>
  );
}
