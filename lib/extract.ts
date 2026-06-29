import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Best-effort full-text extraction. Follows redirects (Google News links land
 * on the publisher) and pulls the densest block of <p> text. Always returns a
 * string — callers fall back to the RSS snippet when this is short/empty.
 */
export async function extractArticle(url: string): Promise<{ text: string; finalUrl: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const finalUrl = res.url || url;
  const html = await res.text();
  const $ = cheerio.load(html);

  $("script, style, noscript, nav, header, footer, aside, form, figure, .ad, .advertisement").remove();

  // Prefer semantic containers, then fall back to the body.
  const candidates = ["article", "main", '[itemprop="articleBody"]', ".article-body", "#articleBody", "body"];
  let best = "";
  for (const sel of candidates) {
    const node = $(sel).first();
    if (!node.length) continue;
    const text = node
      .find("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 30)
      .join("\n\n");
    if (text.length > best.length) best = text;
    if (best.length > 600) break;
  }

  if (best.length < 200) {
    // last resort: all paragraphs anywhere
    best = $("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 30)
      .join("\n\n");
  }

  return { text: best.replace(/\s+\n/g, "\n").slice(0, 6000), finalUrl };
}
