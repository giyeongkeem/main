"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/store/useProject";
import Stepper from "@/components/Stepper";
import SettingsModal from "@/components/SettingsModal";
import Step1Topic from "@/components/steps/Step1Topic";
import Step2News from "@/components/steps/Step2News";
import Step3Article from "@/components/steps/Step3Article";
import Step4Design from "@/components/steps/Step4Design";
import Step5Export from "@/components/steps/Step5Export";

const STEP_TITLES = [
  "1. 어떤 주제로 만들까요?",
  "2. 최신 뉴스 수집 & 요약",
  "3. 카드뉴스 아티클 작성",
  "4. 카드 디자인 & 편집",
  "5. 출력 & 패키징",
];

export default function Home() {
  const { step, settings, reset } = useProject();
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // zustand persist hydrates after mount — avoid SSR mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">불러오는 중…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-edge bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-lg">🗞️</span>
            <span>Card News Studio</span>
          </div>
          <div className="mx-auto">
            <Stepper />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/5 px-2.5 py-1 text-xs text-gray-400 md:inline">
              {settings.provider === "claude" ? "Claude" : "OpenAI"}
            </span>
            <button
              className="btn-ghost btn-sm"
              onClick={() => {
                if (confirm("현재 작업을 모두 지우고 새로 시작할까요?")) reset();
              }}
            >
              새로
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setShowSettings(true)}>
              ⚙️ 설정
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-5 text-xl font-bold">{STEP_TITLES[step]}</h1>
        {step === 0 && <Step1Topic />}
        {step === 1 && <Step2News />}
        {step === 2 && <Step3Article />}
        {step === 3 && <Step4Design />}
        {step === 4 && <Step5Export />}
      </main>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
