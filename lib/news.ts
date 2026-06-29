import Parser from "rss-parser";
import type { NewsItem } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
});

function hostOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function stripHtml(s = ""): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function idFor(link: string, i: number): string {
  return `${Date.now().toString(36)}-${i}-${Math.abs(hashCode(link)).toString(36)}`;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

async function parse(url: string, sourceName?: string): Promise<NewsItem[]> {
  const feed = await parser.parseURL(url);
  const feedTitle = sourceName || feed.title || hostOf(url);
  return (feed.items || []).map((it, i) => {
    const link = it.link || "";
    // Google News wraps the source in the title as "헤드라인 - 매체명"
    let title = stripHtml(it.title || "");
    let source = feedTitle;
    const dash = title.lastIndexOf(" - ");
    if (sourceName === "Google News" && dash > 0 && title.length - dash < 30) {
      source = title.slice(dash + 3).trim();
      title = title.slice(0, dash).trim();
    } else {
      source = it.creator || feedTitle || hostOf(link);
    }
    return {
      id: idFor(link, i),
      title,
      link,
      source,
      published: it.isoDate || it.pubDate,
      snippet: stripHtml((it as { contentSnippet?: string }).contentSnippet || it.content || "").slice(0, 280),
    } satisfies NewsItem;
  });
}

export function googleNewsUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

function matchesKeyword(item: NewsItem, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const hay = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

export interface FetchNewsOptions {
  topic: string;
  /** extra static feed urls to merge in (filtered by topic keywords) */
  feeds?: { name: string; url: string }[];
  limit?: number;
}

export async function fetchNews({ topic, feeds = [], limit = 24 }: FetchNewsOptions): Promise<NewsItem[]> {
  const keywords = topic.split(/[\s,]+/).filter(Boolean);
  const jobs: Promise<NewsItem[]>[] = [];

  if (topic.trim()) {
    jobs.push(parse(googleNewsUrl(topic), "Google News").catch(() => []));
  }
  for (const f of feeds) {
    jobs.push(
      parse(f.url, f.name)
        .then((items) => items.filter((it) => matchesKeyword(it, keywords)))
        .catch(() => [])
    );
  }

  const results = (await Promise.all(jobs)).flat();

  // de-dupe by title (Google News + a feed often carry the same story)
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const it of results) {
    const key = it.title.replace(/\s+/g, "").slice(0, 40);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }

  deduped.sort((a, b) => {
    const da = a.published ? Date.parse(a.published) : 0;
    const db = b.published ? Date.parse(b.published) : 0;
    return db - da;
  });

  return deduped.slice(0, limit);
}
