import { NextResponse } from "next/server";
import { signIn, verifyPassword } from "@/lib/admin-auth";

export async function POST(req: Request) {
  let password = "";
  try {
    const body = await req.json();
    password = body?.password ?? "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await signIn();
  return NextResponse.json({ ok: true });
}
