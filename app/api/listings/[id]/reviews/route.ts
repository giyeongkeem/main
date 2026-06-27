import { NextResponse } from "next/server";
import { addReview, deleteReview, getById } from "@/lib/store";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// 공개: 후기 작성
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getById(id);
  if (!listing || (listing.status ?? "published") !== "published") {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }
  let body: { author?: string; rating?: number; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.text || !body.text.trim()) {
    return NextResponse.json({ error: "후기 내용을 입력해 주세요." }, { status: 400 });
  }
  const updated = await addReview(id, {
    author: body.author ?? "익명",
    rating: Number(body.rating) || 5,
    text: body.text,
  });
  return NextResponse.json(updated, { status: 201 });
}

// 관리자: 후기 삭제
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  const { id } = await params;
  let reviewId = "";
  try {
    reviewId = (await req.json())?.reviewId ?? "";
  } catch {
    /* ignore */
  }
  const updated = await deleteReview(id, reviewId);
  if (!updated) return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(updated);
}
