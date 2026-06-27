import Link from "next/link";
import type { Listing } from "@/lib/types";
import { categoryMeta, verifiedCertCount } from "@/lib/data";
import { FacilityImage } from "./FacilityImage";
import { RatingStars } from "./RatingStars";
import { CompareToggle } from "./CompareToggle";
import { BadgeCheckIcon, MapPinIcon } from "./Icons";

export function ListingCard({ listing }: { listing: Listing }) {
  const meta = categoryMeta(listing.type);
  const verified = verifiedCertCount(listing);
  const cover = listing.photos[0];

  return (
    <article className="card group relative overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-lift">
      <div className="absolute right-3 top-3 z-20">
        <CompareToggle id={listing.id} variant="icon" />
      </div>

      <Link href={`/listings/${listing.id}`} className="block">
        <div className="relative h-44 w-full">
          <FacilityImage
            tone={cover?.tone ?? 0}
            icon={meta.icon}
            label={cover?.label}
            className="h-full w-full"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-ink-soft shadow-sm backdrop-blur-sm">
            {meta.short}
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold text-ink group-hover:text-brand-700">
              {listing.name}
            </h3>
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-muted">{listing.tagline}</p>

          <div className="mt-2.5 flex items-center gap-2">
            <RatingStars value={listing.rating} size={14} showValue count={listing.reviewCount} />
          </div>

          <div className="mt-2 flex items-center gap-1 text-sm text-ink-muted">
            <MapPinIcon width={15} height={15} className="text-ink-muted" />
            <span>{listing.district} · {listing.neighborhood}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {verified > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                <BadgeCheckIcon width={14} height={14} />
                자격증 인증 {verified}
              </span>
            )}
            {listing.specialties.slice(0, 2).map((s) => (
              <span key={s} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-ink-soft">
                {s}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-base font-extrabold text-ink">{listing.priceLabel}</span>
            <span className="text-xs font-semibold text-brand-700 group-hover:underline">
              자세히 보기 →
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
