"use client";

import { signIn } from "next-auth/react";

type Enabled = { kakao: boolean; naver: boolean; apple: boolean };

export function SocialLogin({ enabled, callbackUrl = "/" }: { enabled: Enabled; callbackUrl?: string }) {
  const anyEnabled = enabled.kakao || enabled.naver || enabled.apple;

  return (
    <div className="space-y-2.5">
      <ProviderButton
        provider="kakao"
        enabled={enabled.kakao}
        onClick={() => signIn("kakao", { callbackUrl })}
        className="bg-[#FEE500] text-[#191600] hover:brightness-95"
        icon={<KakaoIcon />}
        label="카카오로 시작하기"
      />
      <ProviderButton
        provider="naver"
        enabled={enabled.naver}
        onClick={() => signIn("naver", { callbackUrl })}
        className="bg-[#03C75A] text-white hover:brightness-95"
        icon={<span className="text-base font-extrabold">N</span>}
        label="네이버로 시작하기"
      />
      <ProviderButton
        provider="apple"
        enabled={enabled.apple}
        onClick={() => signIn("apple", { callbackUrl })}
        className="bg-black text-white hover:bg-neutral-800"
        icon={<AppleIcon />}
        label="Apple로 계속하기"
      />

      {!anyEnabled && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-center text-xs leading-relaxed text-ink-muted">
          소셜 로그인은 환경변수(키) 설정 후 활성화됩니다.<br />
          README의 “소셜 로그인 설정”을 참고하세요.
        </p>
      )}
    </div>
  );
}

function ProviderButton({
  enabled,
  onClick,
  className,
  icon,
  label,
}: {
  provider: string;
  enabled: boolean;
  onClick: () => void;
  className: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span className="grid h-5 w-5 place-items-center">{icon}</span>
      {label}
      {!enabled && <span className="text-[11px] font-medium opacity-70">(준비 중)</span>}
    </button>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.6-1.8 3.6-2.5.7.1 1.4.2 2.1.2 5.5 0 10-3.6 10-8S17.5 3 12 3Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8ZM14.3 5.8c.6-.8 1-1.8.9-2.8-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.2Z" />
    </svg>
  );
}
