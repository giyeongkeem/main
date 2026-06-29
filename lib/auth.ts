/**
 * 소셜 로그인 (Auth.js / next-auth v5) — 서버 전용.
 *
 * 각 제공자는 환경변수가 설정된 경우에만 활성화됩니다(없으면 버튼이 비활성).
 *   카카오 : AUTH_KAKAO_ID, AUTH_KAKAO_SECRET
 *   네이버 : AUTH_NAVER_ID, AUTH_NAVER_SECRET
 *   애플   : AUTH_APPLE_ID, AUTH_APPLE_SECRET   (Apple은 .p8 키로 만든 JWT가 secret)
 *   공통   : AUTH_SECRET (세션 서명용)
 *
 * 세션은 JWT 방식이라 별도 사용자 테이블 없이 동작합니다.
 */
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Kakao from "next-auth/providers/kakao";
import Naver from "next-auth/providers/naver";
import Apple from "next-auth/providers/apple";

const has = (a?: string, b?: string) => Boolean(a && b);

export const enabledProviders = {
  kakao: has(process.env.AUTH_KAKAO_ID, process.env.AUTH_KAKAO_SECRET),
  naver: has(process.env.AUTH_NAVER_ID, process.env.AUTH_NAVER_SECRET),
  apple: has(process.env.AUTH_APPLE_ID, process.env.AUTH_APPLE_SECRET),
};

export const anyProviderEnabled =
  enabledProviders.kakao || enabledProviders.naver || enabledProviders.apple;

const providers: Provider[] = [];
if (enabledProviders.kakao) {
  providers.push(
    Kakao({ clientId: process.env.AUTH_KAKAO_ID!, clientSecret: process.env.AUTH_KAKAO_SECRET! })
  );
}
if (enabledProviders.naver) {
  providers.push(
    Naver({ clientId: process.env.AUTH_NAVER_ID!, clientSecret: process.env.AUTH_NAVER_SECRET! })
  );
}
if (enabledProviders.apple) {
  providers.push(
    Apple({ clientId: process.env.AUTH_APPLE_ID!, clientSecret: process.env.AUTH_APPLE_SECRET! })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  secret: process.env.AUTH_SECRET || "dev-insecure-fitmatch-secret-change-me",
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
});
