import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getById } from "@/lib/store";
import { ListingForm } from "@/components/admin/ListingForm";
import { ChevronRightIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const listing = await getById(id);
  if (!listing) notFound();

  return (
    <div className="container-page max-w-4xl py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/admin" className="hover:text-brand-700">관리자 콘솔</Link>
        <ChevronRightIcon width={14} height={14} />
        <span className="truncate font-medium text-ink-soft">{listing.name} 수정</span>
      </nav>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-ink">전문가 · 센터 수정</h1>
      <ListingForm mode="edit" initial={listing} />
    </div>
  );
}
