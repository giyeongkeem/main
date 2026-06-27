import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { ListingForm } from "@/components/admin/ListingForm";
import { ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="container-page max-w-4xl py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/admin" className="hover:text-brand-700">관리자 콘솔</Link>
        <ChevronRightIcon width={14} height={14} />
        <span className="font-medium text-ink-soft">새 전문가 등록</span>
      </nav>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-ink">새 전문가 · 센터 등록</h1>
      <ListingForm mode="create" />
    </div>
  );
}
