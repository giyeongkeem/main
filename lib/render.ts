import { chromium, type Browser } from "playwright";
import JSZip from "jszip";
import { renderCardHTML } from "./cardTemplate";
import type { Card, Design, Meta } from "./types";

/**
 * Resolve a Chromium to launch. In dev/prod on the user's machine Playwright
 * finds its own download; in some managed environments a prebuilt browser lives
 * at PLAYWRIGHT_CHROMIUM_PATH / a known path. We try the bundled one first and
 * fall back to an explicit executable path.
 */
async function launch(): Promise<Browser> {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"];
  try {
    return await chromium.launch({ args, ...(explicit ? { executablePath: explicit } : {}) });
  } catch (err) {
    // Fallback to a common managed-environment location before giving up.
    const fallback = "/opt/pw-browsers/chromium";
    try {
      return await chromium.launch({ args, executablePath: fallback });
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
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  try {
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
