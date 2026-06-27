import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getAll, STORAGE } from "@/lib/store";
import { categoryMeta, CATEGORY_LABEL, verifiedCertCount } from "@/lib/data";
import { FacilityImage } from "@/components/FacilityImage";
import { ApproveButton, DeleteButton, LogoutButton } from "@/components/admin/AdminActions";
import { BadgeCheckIcon, ClockIcon, DumbbellIcon, SparklesIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  if (!(await isAdmin())) redirect("/admin/login");
  const all = await getAll();
  const pending = all.filter((l) => (l.status ?? "published") === "pending");
  const published = all.filter((l) => (l.status ?? "published") === "published");

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
            <p className="text-xs text-ink-muted">
              전문가·센터 정보와 사진을 관리합니다 · 저장:{" "}
              <span className="font-semibold text-ink-soft">
                {STORAGE === "postgres" ? "PostgreSQL" : "로컬 JSON"}
              </span>
            </p>
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
        <Summary value={published.length} label="공개 중" />
        <Summary value={pending.length} label="승인 대기" icon={<ClockIcon width={16} height={16} />} highlight={pending.length > 0} />
        <Summary value={all.filter((l) => verifiedCertCount(l) > 0).length} label="자격증 인증" icon={<BadgeCheckIcon width={16} height={16} />} />
        <Summary value={all.filter((l) => l.featured).length} label="추천 노출" icon={<SparklesIcon width={16} height={16} />} />
      </div>

      {/* 승인 대기 */}
      {pending.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-amber-800">
            <ClockIcon width={18} height={18} /> 승인 대기 ({pending.length})
          </h2>
          <p className="mt-1 text-sm text-amber-700/80">업체 셀프 등록 신청입니다. 검수 후 승인하면 사이트에 공개됩니다.</p>
          <ul className="mt-4 space-y-3">
            {pending.map((l) => {
              const meta = categoryMeta(l.type);
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-white p-3">
                  <FacilityImage tone={l.photos[0]?.tone ?? 0} url={l.photos[0]?.url} icon={meta.icon} showLabel={false} className="h-10 w-12 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{l.name} <span className="text-xs font-normal text-ink-muted">· {CATEGORY_LABEL[l.type]}</span></p>
                    <p className="truncate text-xs text-ink-muted">
                      {l.district} {l.neighborhood}
                      {l.submitterContact ? ` · 연락처: ${l.submitterContact}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ApproveButton id={l.id} name={l.name} />
                    <Link href={`/admin/listings/${l.id}/edit`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand-300 hover:text-brand-700">보완 수정</Link>
                    <DeleteButton id={l.id} name={l.name} label="반려" confirmText={`‘${l.name}’ 신청을 반려(삭제)할까요?`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 공개 목록 */}
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
              {published.map((l) => {
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

function Summary({ value, label, icon, highlight }: { value: number; label: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`card px-4 py-3 ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="flex items-center gap-1.5 text-2xl font-extrabold text-ink">
        {icon && <span className={highlight ? "text-amber-600" : "text-brand-600"}>{icon}</span>}
        {value}
      </div>
      <div className="mt-0.5 text-xs text-ink-muted">{label}</div>
    </div>
  );
}
