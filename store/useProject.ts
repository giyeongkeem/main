"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Article, Card, Design, LLMSettings, Meta, NewsItem } from "@/lib/types";
import { DEFAULT_DESIGN, DEFAULT_META, DEFAULT_FEEDS, type FeedSource } from "@/lib/presets";
import { DEFAULT_MODELS } from "@/lib/llm";

let n = 0;
export const newId = () => `c${Date.now().toString(36)}${(n++).toString(36)}`;

interface Store {
  step: number;
  meta: Meta;
  feeds: FeedSource[];
  news: NewsItem[];
  summary: string;
  article: Article | null;
  design: Design;
  settings: LLMSettings;

  setStep: (s: number) => void;
  setMeta: (m: Partial<Meta>) => void;
  setFeeds: (f: FeedSource[]) => void;
  setNews: (items: NewsItem[]) => void;
  toggleNews: (id: string) => void;
  patchNews: (id: string, patch: Partial<NewsItem>) => void;
  setSummary: (s: string) => void;
  setArticle: (a: Article | null) => void;
  updateCard: (id: string, patch: Partial<Card>) => void;
  addCard: (afterId?: string) => void;
  removeCard: (id: string) => void;
  moveCard: (id: string, dir: -1 | 1) => void;
  setDesign: (d: Partial<Design>) => void;
  setSettings: (s: Partial<LLMSettings>) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS: LLMSettings = {
  provider: "claude",
  claudeModel: DEFAULT_MODELS.claude,
  openaiModel: DEFAULT_MODELS.openai,
  claudeKey: "",
  openaiKey: "",
};

export const useProject = create<Store>()(
  persist(
    (set) => ({
      step: 0,
      meta: { ...DEFAULT_META },
      feeds: [...DEFAULT_FEEDS],
      news: [],
      summary: "",
      article: null,
      design: { ...DEFAULT_DESIGN },
      settings: { ...DEFAULT_SETTINGS },

      setStep: (step) => set({ step }),
      setMeta: (m) => set((s) => ({ meta: { ...s.meta, ...m } })),
      setFeeds: (feeds) => set({ feeds }),
      setNews: (news) => set({ news }),
      toggleNews: (id) =>
        set((s) => ({ news: s.news.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)) })),
      patchNews: (id, patch) =>
        set((s) => ({ news: s.news.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
      setSummary: (summary) => set({ summary }),
      setArticle: (article) => set({ article }),
      updateCard: (id, patch) =>
        set((s) =>
          s.article
            ? { article: { ...s.article, cards: s.article.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) } }
            : {}
        ),
      addCard: (afterId) =>
        set((s) => {
          if (!s.article) return {};
          const card: Card = { id: newId(), kind: "content", eyebrow: "", title: "새 카드", body: "내용을 입력하세요." };
          const cards = [...s.article.cards];
          const idx = afterId ? cards.findIndex((c) => c.id === afterId) : cards.length - 1;
          cards.splice(idx + 1, 0, card);
          return { article: { ...s.article, cards } };
        }),
      removeCard: (id) =>
        set((s) =>
          s.article && s.article.cards.length > 1
            ? { article: { ...s.article, cards: s.article.cards.filter((c) => c.id !== id) } }
            : {}
        ),
      moveCard: (id, dir) =>
        set((s) => {
          if (!s.article) return {};
          const cards = [...s.article.cards];
          const i = cards.findIndex((c) => c.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= cards.length) return {};
          [cards[i], cards[j]] = [cards[j], cards[i]];
          return { article: { ...s.article, cards } };
        }),
      setDesign: (d) => set((s) => ({ design: { ...s.design, ...d } })),
      setSettings: (st) => set((s) => ({ settings: { ...s.settings, ...st } })),
      reset: () =>
        set({
          step: 0,
          meta: { ...DEFAULT_META },
          news: [],
          summary: "",
          article: null,
          design: { ...DEFAULT_DESIGN },
        }),
    }),
    { name: "cardnews-studio-v1" }
  )
);
