// ── Shared data model for the whole card-news pipeline ──────────────────────

export type Provider = "claude" | "openai";

export interface LLMSettings {
  provider: Provider;
  claudeModel: string;
  openaiModel: string;
  /** Optional keys stored client-side (localStorage). Server falls back to env. */
  claudeKey?: string;
  openaiKey?: string;
}

// ── News (step 2) ───────────────────────────────────────────────────────────

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  /** ISO date string if available */
  published?: string;
  /** plain-text snippet from the feed */
  snippet?: string;
  /** full extracted article text, filled in on demand */
  content?: string;
  selected?: boolean;
}

// ── Article (step 3) ────────────────────────────────────────────────────────

export type CardKind = "cover" | "content" | "closing";

/** how a card's image is placed */
export type ImageMode = "background" | "top";

export interface Card {
  id: string;
  kind: CardKind;
  /** small label above the title (e.g. category, page intent) */
  eyebrow?: string;
  title?: string;
  body?: string;
  /** optional image — data URL (uploaded) or http(s) URL */
  image?: string;
  /** placement of the image; defaults per kind when an image is set */
  imageMode?: ImageMode;
  /** scrim strength over background images (0–0.9), for text legibility */
  imageOverlay?: number;
  /** horizontal text alignment override (defaults: cover=center, others=left) */
  align?: "left" | "center";
}

export interface Article {
  /** headline used on the cover card */
  headline: string;
  /** one-line hook / subtitle */
  subtitle?: string;
  cards: Card[];
  /** suggested instagram caption + hashtags */
  caption?: string;
}

// ── Design / theme (steps 4 & 6) ────────────────────────────────────────────

export type TemplateId = "editorial" | "bold" | "minimal" | "gradient";

export interface Palette {
  id: string;
  name: string;
  bg: string;
  fg: string;
  accent: string;
  /** secondary / muted foreground */
  muted: string;
  /** true if the accent works as a solid block behind dark text */
  accentText?: string;
}

export interface CanvasSize {
  id: string;
  label: string;
  w: number;
  h: number;
}

export interface Design {
  template: TemplateId;
  palette: Palette;
  size: CanvasSize;
  /** heading size multiplier (0.8 – 1.4) */
  headingScale: number;
  showPageNumbers: boolean;
  showHandle: boolean;
  /** font ids from lib/fonts.ts — undefined (old projects) falls back to Pretendard */
  headingFont?: string;
  bodyFont?: string;
}

export interface Meta {
  topic: string;
  angle?: string;
  tone: string;
  handle: string;
}

// ── Whole project (persisted) ───────────────────────────────────────────────

export interface ProjectState {
  meta: Meta;
  news: NewsItem[];
  summary: string;
  article: Article | null;
  design: Design;
}

// ── API payloads ────────────────────────────────────────────────────────────

export interface RenderRequest {
  cards: Card[];
  design: Design;
  meta: Meta;
}
