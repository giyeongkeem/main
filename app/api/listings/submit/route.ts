import { NextResponse } from "next/server";
import { createListing } from "@/lib/store";
import type { ListingType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: ListingType[] = ["fitness", "pt", "pilates-trainer", "pilates-center"];

// 공개: 업체/전문가 셀프 등록 신청 (관리자 승인 전까지 비공개 pending)
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const type = body.type as ListingType;
  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "카테고리를 선택해 주세요." }, { status: 400 });

  const created = await createListing({
    name,
    type,
    tagline: String(body.tagline ?? ""),
    district: String(body.district ?? "강남구"),
    neighborhood: String(body.neighborhood ?? ""),
    address: String(body.address ?? ""),
    priceLabel: String(body.priceLabel ?? ""),
    description: String(body.description ?? ""),
    specialties: Array.isArray(body.specialties) ? (body.specialties as string[]) : [],
    submitterContact: String(body.submitterContact ?? ""),
    rating: 0,
    reviewCount: 0,
    reviews: [],
    status: "pending",
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
