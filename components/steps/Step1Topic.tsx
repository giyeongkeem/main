"use client";

import { useProject } from "@/store/useProject";

const TONES = ["정보 전달 · 신뢰감 있는", "친근하고 캐주얼한", "전문가 분석 · 인사이트", "위트있고 가벼운", "팩트 중심 · 건조한"];

export default function Step1Topic() {
  const { meta, setMeta, setStep } = useProject();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="card-panel space-y-4">
        <div>
          <label className="label">주제 / 키워드 *</label>
          <input
            className="field"
            placeholder="예: 전기차 보조금, AI 규제, 금리 인하…"
            value={meta.topic}
            onChange={(e) => setMeta({ topic: e.target.value })}
          />
          <p className="mt-1 text-xs text-gray-500">이 키워드로 최신 뉴스를 검색합니다. 구체적일수록 좋아요.</p>
        </div>

        <div>
          <label className="label">관점 / 앵글 (선택)</label>
          <input
            className="field"
            placeholder="예: 소비자 입장에서, 초보자도 이해하기 쉽게…"
            value={meta.angle ?? ""}
            onChange={(e) => setMeta({ angle: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">톤앤매너</label>
            <select className="field" value={meta.tone} onChange={(e) => setMeta({ tone: e.target.value })}>
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">인스타 핸들</label>
            <input className="field" value={meta.handle} onChange={(e) => setMeta({ handle: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={!meta.topic.trim()} onClick={() => setStep(1)}>
          다음: 뉴스 가져오기 →
        </button>
      </div>
    </div>
  );
}
