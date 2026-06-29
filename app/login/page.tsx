import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, enabledProviders } from "@/lib/auth";
import { SocialLogin } from "@/components/SocialLogin";
import { DumbbellIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="container-page flex min-h-[72vh] items-center justify-center py-12">
      <div className="card w-full max-w-sm p-7">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white">
            <DumbbellIcon width={20} height={20} />
          </span>
          <span className="text-lg font-extrabold text-ink">핏매치<span className="text-brand-600">.</span></span>
        </Link>
        <h1 className="mt-6 text-xl font-extrabold text-ink">로그인 / 회원가입</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          소셜 계정으로 간편하게 시작하고, 후기를 내 이름으로 남겨보세요.
        </p>

        <div className="mt-6">
          <SocialLogin enabled={enabledProviders} />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-muted">
          로그인 시 데모 서비스의 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
        <Link href="/" className="mt-4 block text-center text-sm text-brand-700 hover:underline">
          ← 둘러보기로 돌아가기
        </Link>
      </div>
    </div>
  );
}
