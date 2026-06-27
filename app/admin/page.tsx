import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getAll } from "@/lib/store";
import { categoryMeta, CATEGORY_LABEL, verifiedCertCount } from "@/lib/data";
import { FacilityImage } from "@/components/FacilityImage";
import { DeleteButton, LogoutButton } from "@/components/admin/AdminActions";
import { BadgeCheckIcon, DumbbellIcon, SparklesIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  if (!(await isAdmin())) redirect("/admin/login");
  const listings = await getAll();

  return (
    <div className="container-page py-8">
      {/* 헤더 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <DumbbellIcon width={20} height={20} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink">관리자 콘솔</h1>
            <p className="text-xs text-ink-muted">전문가·센터 정보와 사진을 관리합니다.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="btn-ghost px-3 py-2 text-sm">사이트 보기</Link>
          <LogoutButton />
          <Link href="/admin/listings/new" className="btn-primary">+ 새 전문가 등록</Link>
        </div>
      </div>

      {/* 요약 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary value={listings.length} label="전체 등록" />
        <Summary value={listings.filter((l) => verifiedCertCount(l) > 0).length} label="자격증 인증" icon={<BadgeCheckIcon width={16} height={16} />} />
        <Summary value={listings.filter((l) => l.featured).length} label="추천 노출" icon={<SparklesIcon width={16} height={16} />} />
        <Summary value={listings.filter((l) => (l.photos?.some((p) => p.url))).length} label="사진 등록" />
      </div>

      {/* 목록 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold text-ink-muted">
              <tr>
                <th className="px-4 py-3">전문가 / 센터</th>
                <th className="px-4 py-3">카테고리</th>
                <th className="px-4 py-3">지역</th>
                <th className="px-4 py-3">가격</th>
                <th className="px-4 py-3">평점</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => {
                const meta = categoryMeta(l.type);
                const verified = verifiedCertCount(l);
                return (
                  <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FacilityImage tone={l.photos[0]?.tone ?? 0} url={l.photos[0]?.url} icon={meta.icon} showLabel={false} className="h-10 w-12 shrink-0 rounded-lg" />
                        <div className="min-w-0">
                          <Link href={`/listings/${l.id}`} className="block truncate font-semibold text-ink hover:text-brand-700">{l.name}</Link>
                          <span className="block truncate text-xs text-ink-muted">{l.tagline}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{CATEGORY_LABEL[l.type]}</td>
                    <td className="px-4 py-3 text-ink-soft">{l.district} {l.neighborhood}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{l.priceLabel}</td>
                    <td className="px-4 py-3 text-ink-soft">★ {l.rating.toFixed(1)} <span className="text-xs text-ink-muted">({l.reviewCount})</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {verified > 0 && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">인증 {verified}</span>}
                        {l.featured && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">추천</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/listings/${l.id}/edit`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-700">수정</Link>
                        <DeleteButton id={l.id} name={l.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Summary({ value, label, icon }: { value: number; label: string; icon?: React.ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center gap-1.5 text-2xl font-extrabold text-ink">
        {icon && <span className="text-brand-600">{icon}</span>}
        {value}
      </div>
      <div className="mt-0.5 text-xs text-ink-muted">{label}</div>
    </div>
  );
}
