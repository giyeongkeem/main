/**
 * 간단한 관리자(마스터) 인증 — 서버 전용.
 * 이번 단계는 단일 관리자 비밀번호 방식입니다.
 * 다음 단계에서 카카오/이메일 로그인 + 역할(role) 기반 권한으로 교체할 수 있습니다.
 *
 * 비밀번호는 환경변수로 바꾸세요:  ADMIN_PASSWORD="원하는비번"
 */
import { cookies } from "next/headers";
import crypto from "node:crypto";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin1234";
const SECRET = process.env.ADMIN_SECRET || "fitmatch-local-dev-secret";
const COOKIE = "fitmatch_admin";

function token(): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update("fitmatch-admin:" + ADMIN_PASSWORD)
    .digest("hex");
}

export function verifyPassword(pw: unknown): boolean {
  return typeof pw === "string" && pw.length > 0 && pw === ADMIN_PASSWORD;
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === token();
}

export async function signIn(): Promise<void> {
  const jar = await cookies();
  // HTTPS 배포(Vercel 등)에서는 Secure 쿠키 사용. COOKIE_SECURE=true/false 로 강제 지정 가능.
  const secure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : !!process.env.VERCEL;
  jar.set(COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
