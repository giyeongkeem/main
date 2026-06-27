import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createListing } from "@/lib/store";

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body?.name || !body?.type) {
    return NextResponse.json({ error: "이름과 카테고리는 필수입니다." }, { status: 400 });
  }
  const created = await createListing(body);
  return NextResponse.json(created, { status: 201 });
}
