"use client";

import { useProject } from "@/store/useProject";
import type { FeedSource } from "@/lib/presets";

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings, feeds, setFeeds } = useProject();
  if (!open) return null;

  const updateFeed = (i: number, patch: Partial<FeedSource>) =>
    setFeeds(feeds.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const addFeed = () => setFeeds([...feeds, { name: "새 피드", url: "", enabled: true }]);
  const removeFeed = (i: number) => setFeeds(feeds.filter((_, idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl card-panel">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">설정</h2>
          <button onClick={onClose} className="btn-ghost btn-sm">
            닫기 ✕
          </button>
        </div>

        {/* provider */}
        <div className="mb-6">
          <div className="label">AI 모델</div>
          <div className="mb-3 flex gap-2">
            {(["claude", "openai"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSettings({ provider: p })}
                className={`btn flex-1 ${settings.provider === p ? "bg-blue-500 text-white" : "border border-edge text-gray-300"}`}
              >
                {p === "claude" ? "Claude (Anthropic)" : "OpenAI (GPT)"}
              </button>
            ))}
          </div>

          {settings.provider === "claude" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Claude 모델</label>
                <input className="field" value={settings.claudeModel} onChange={(e) => setSettings({ claudeModel: e.target.value })} />
              </div>
              <div>
                <label className="label">ANTHROPIC API 키</label>
                <input
                  type="password"
                  className="field"
                  placeholder="sk-ant-… (비워두면 서버 환경변수 사용)"
                  value={settings.claudeKey ?? ""}
                  onChange={(e) => setSettings({ claudeKey: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">OpenAI 모델</label>
                <input className="field" value={settings.openaiModel} onChange={(e) => setSettings({ openaiModel: e.target.value })} />
              </div>
              <div>
                <label className="label">OPENAI API 키</label>
                <input
                  type="password"
                  className="field"
                  placeholder="sk-… (비워두면 서버 환경변수 사용)"
                  value={settings.openaiKey ?? ""}
                  onChange={(e) => setSettings({ openaiKey: e.target.value })}
                />
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">
            키는 이 브라우저(localStorage)에만 저장되어 요청 시 함께 전송됩니다. 키 칸을 비우면 서버의 환경변수(.env.local)를 사용합니다.
          </p>
        </div>

        {/* feeds */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="label mb-0">RSS 피드 (Google News 검색은 항상 포함)</div>
            <button onClick={addFeed} className="btn-ghost btn-sm">
              + 추가
            </button>
          </div>
          <div className="space-y-2">
            {feeds.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  onChange={(e) => updateFeed(i, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-blue-500"
                />
                <input
                  className="field w-32 shrink-0"
                  value={f.name}
                  placeholder="이름"
                  onChange={(e) => updateFeed(i, { name: e.target.value })}
                />
                <input
                  className="field flex-1"
                  value={f.url}
                  placeholder="https://…/rss"
                  onChange={(e) => updateFeed(i, { url: e.target.value })}
                />
                <button onClick={() => removeFeed(i)} className="btn-ghost btn-sm shrink-0">
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
