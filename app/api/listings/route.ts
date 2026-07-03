import { NextResponse } from "next/server";
import { getPublished, toPublic } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const all = (await getPublished()).map(toPublic);
  const idsParam = new URL(req.url).searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const byId = new Map(all.map((l) => [l.id, l]));
    // 요청한 id 순서를 보존
    return NextResponse.json(ids.map((id) => byId.get(id)).filter(Boolean));
  }
  return NextResponse.json(all);
}
