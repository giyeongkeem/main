"use client";

import { useProject } from "@/store/useProject";

const STEPS = [
  { n: 1, label: "주제 선정" },
  { n: 2, label: "뉴스·요약" },
  { n: 3, label: "아티클" },
  { n: 4, label: "디자인·편집" },
  { n: 5, label: "내보내기" },
];

export default function Stepper() {
  const { step, setStep } = useProject();

  return (
    <nav className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <button
            key={s.n}
            onClick={() => setStep(i)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-blue-500 text-white" : done ? "bg-white/10 text-gray-200" : "text-gray-500 hover:bg-white/5"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                active ? "bg-white text-blue-600" : done ? "bg-blue-500 text-white" : "bg-white/10"
              }`}
            >
              {done ? "✓" : s.n}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
