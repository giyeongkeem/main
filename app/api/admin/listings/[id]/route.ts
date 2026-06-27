import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { deleteListing, updateListing } from "@/lib/store";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const updated = await updateListing(id, body);
  if (!updated) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteListing(id);
  if (!ok) {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
