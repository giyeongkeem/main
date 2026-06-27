import { Suspense } from "react";
import type { Metadata } from "next";
import { ListingsClient } from "@/components/ListingsClient";

export const metadata: Metadata = {
  title: "전문가 둘러보기",
  description:
    "서울의 피트니스·퍼스널 트레이너·필라테스 전문가를 지역, 가격, 자격증, 전문 분야로 필터링하고 비교하세요.",
};

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-ink-muted">불러오는 중…</div>}>
      <ListingsClient />
    </Suspense>
  );
}
