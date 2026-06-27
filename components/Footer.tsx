import Link from "next/link";
import { CATEGORIES } from "@/lib/data";
import { DumbbellIcon } from "./Icons";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
              <DumbbellIcon width={20} height={20} />
            </span>
            <span className="text-lg font-extrabold text-ink">핏매치<span className="text-brand-600">.</span></span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
            서울의 검증된 피트니스·퍼스널 트레이너·필라테스 전문가를 자격증, 후기,
            시설 사진으로 비교하고 선택하세요.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-ink">카테고리</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {CATEGORIES.map((c) => (
              <li key={c.type}>
                <Link href={`/listings?type=${c.type}`} className="hover:text-brand-700">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold text-ink">서비스</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link href="/listings" className="hover:text-brand-700">전체 둘러보기</Link></li>
            <li><Link href="/compare" className="hover:text-brand-700">비교함</Link></li>
            <li><Link href="/listings?verified=1" className="hover:text-brand-700">자격증 인증 전문가</Link></li>
            <li><Link href="/register" className="hover:text-brand-700">전문가·센터 등록 신청</Link></li>
            <li><Link href="/admin" className="hover:text-brand-700">관리자 콘솔</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold text-ink">안내</h4>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            본 사이트의 트레이너·센터·후기 정보는 데모용 샘플 데이터입니다.
            실제 인물·업체와 무관합니다.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-muted sm:flex-row">
          <p>© 2026 핏매치 (FitMatch) — 데모 프로젝트</p>
          <p>Made with Next.js · Tailwind CSS</p>
        </div>
      </div>
    </footer>
  );
}
