import Link from "next/link";
import { ArrowRightIcon, SearchIcon } from "@/components/Icons";

export default function NotFound() {
  return (
    <div className="container-page py-24">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600">
          <SearchIcon width={30} height={30} />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold text-ink">페이지를 찾을 수 없어요</h1>
        <p className="mt-2 text-ink-muted">
          요청하신 전문가나 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <Link href="/" className="btn-primary mt-6">
          홈으로 가기 <ArrowRightIcon width={18} height={18} />
        </Link>
      </div>
    </div>
  );
}
