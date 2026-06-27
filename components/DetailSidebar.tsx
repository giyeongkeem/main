"use client";

import type { Listing } from "@/lib/types";
import { CATEGORY_LABEL, verifiedCertCount } from "@/lib/data";
import { CompareToggle } from "./CompareToggle";
import { BadgeCheckIcon, CalendarIcon, ClockIcon, MapPinIcon, PhoneIcon } from "./Icons";

export function DetailSidebar({ listing }: { listing: Listing }) {
  function demo() {
    alert("데모 프로젝트입니다. 실제 예약·상담 연동이 들어갈 위치예요.");
  }

  const verified = verifiedCertCount(listing);

  return (
    <div className="card sticky top-20 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-extrabold text-ink">{listing.priceLabel}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-soft">
          {listing.priceUnit === "session" ? "회당" : "월 정기"}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        <button onClick={demo} className="btn-primary w-full">
          <CalendarIcon width={18} height={18} /> 상담·체험 신청
        </button>
        <button onClick={demo} className="btn-outline w-full">
          <PhoneIcon width={18} height={18} /> 전화 문의
        </button>
        <CompareToggle id={listing.id} variant="button" />
      </div>

      <dl className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
        <Fact label="카테고리" value={CATEGORY_LABEL[listing.type]} />
        <Fact
          label="경력"
          value={`${listing.experienceYears}년`}
          icon={<ClockIcon width={15} height={15} />}
        />
        <Fact
          label="위치"
          value={`${listing.district} ${listing.neighborhood}`}
          icon={<MapPinIcon width={15} height={15} />}
        />
        {verified > 0 && (
          <Fact
            label="자격증 인증"
            value={`${verified}개`}
            icon={<BadgeCheckIcon width={15} height={15} />}
            highlight
          />
        )}
        <Fact label="이용 후기" value={`${listing.reviewCount.toLocaleString()}개`} />
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        * 본 정보는 데모용 샘플입니다. 실제 인물·업체와 무관합니다.
      </p>
    </div>
  );
}

function Fact({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`flex items-center gap-1 font-semibold ${highlight ? "text-brand-700" : "text-ink"}`}>
        {icon}
        {value}
      </dd>
    </div>
  );
}
