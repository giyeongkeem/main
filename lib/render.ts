import { chromium, type Browser, type Page } from "playwright";
import JSZip from "jszip";
import { renderCardHTML } from "./cardTemplate";
import type { Card, Design, Meta } from "./types";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ── webfont relay ────────────────────────────────────────────────────────────
// Headless Chromium can't traverse some TLS-reterminating proxies (corporate
// networks, managed sandboxes), which silently drops webfonts from exports.
// Fetching font CSS/binaries in Node (which honors HTTPS_PROXY / CA env vars)
// and fulfilling the browser request keeps exports font-accurate everywhere.
const FONT_HOST_RE = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)\//;
const fontCache = new Map<string, { status: number; contentType: string; body: Buffer }>();

async function relayFonts(page: Page): Promise<void> {
  await page.route(FONT_HOST_RE, async (route) => {
    const url = route.request().url();
    try {
      let hit = fontCache.get(url);
      if (!hit) {
        const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
        hit = {
          status: res.status,
          contentType: res.headers.get("content-type") || "application/octet-stream",
          body: Buffer.from(await res.arrayBuffer()),
        };
        if (res.ok && fontCache.size < 500) fontCache.set(url, hit);
      }
      await route.fulfill({
        status: hit.status,
        // fonts are CORS-gated; the relay must grant what the CDN would
        headers: { "content-type": hit.contentType, "access-control-allow-origin": "*" },
        body: hit.body,
      });
    } catch {
      // Node-side fetch failed (offline/policy) — let the browser try itself.
      await route.continue().catch(() => {});
    }
  });
}

/**
 * Resolve a Chromium to launch. In dev/prod on the user's machine Playwright
 * finds its own download; in some managed environments a prebuilt browser lives
 * at PLAYWRIGHT_CHROMIUM_PATH / a known path. We try the bundled one first and
 * fall back to an explicit executable path.
 */
async function launch(): Promise<Browser> {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"];
  // Chromium ignores HTTPS_PROXY on its own — in proxied environments webfont
  // requests silently fail without this (local machines have no proxy set).
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  const proxy = proxyUrl ? { server: proxyUrl } : undefined;
  try {
    return await chromium.launch({ args, proxy, ...(explicit ? { executablePath: explicit } : {}) });
  } catch (err) {
    // Fallback to a common managed-environment location before giving up.
    const fallback = "/opt/pw-browsers/chromium";
    try {
      return await chromium.launch({ args, proxy, executablePath: fallback });
    } catch {
      throw new Error(
        `헤드리스 브라우저를 실행하지 못했습니다. 'npx playwright install chromium' 을 실행하세요. (원인: ${
          (err as Error).message
        })`
      );
    }
  }
}

async function shot(browser: Browser, html: string, w: number, h: number): Promise<Buffer> {
  // ignoreHTTPSErrors: we only render our own HTML; in proxied environments
  // the TLS-reterminating proxy presents a cert Chromium wouldn't trust.
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  try {
    await relayFonts(page);
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
    // Make sure the web fonts are actually painted before we capture.
    await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready).catch(() => {});
    const el = await page.$(".canvas");
    const buf = el ? await el.screenshot({ type: "png" }) : await page.screenshot({ type: "png" });
    return buf as Buffer;
  } finally {
    await page.close();
  }
}

export async function renderCardsToPng(
  cards: Card[],
  design: Design,
  meta: Meta
): Promise<{ name: string; buffer: Buffer }[]> {
  const browser = await launch();
  try {
    const out: { name: string; buffer: Buffer }[] = [];
    for (let i = 0; i < cards.length; i++) {
      const html = renderCardHTML({ card: cards[i], design, meta, index: i, total: cards.length });
      const buffer = await shot(browser, html, design.size.w, design.size.h);
      out.push({ name: `card-${String(i + 1).padStart(2, "0")}.png`, buffer });
    }
    return out;
  } finally {
    await browser.close();
  }
}

export async function zipPngs(files: { name: string; buffer: Buffer }[], meta: Meta): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.buffer);
  // include a tiny README + the caption for convenience
  zip.file(
    "_caption.txt",
    `주제: ${meta.topic}\n핸들: ${meta.handle}\n\n생성: Card News Studio\n`
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
