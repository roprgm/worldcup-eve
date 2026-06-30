// Render the live home bracket into the Open Graph / Twitter card images by
// screenshotting the /og-bracket page. Re-run it (locally or from a scheduled
// job) whenever the bracket should refresh — the new PNG's content hash makes
// Next emit a fresh image URL, which busts the social caches.
//
//   OG_URL=https://wc26.chat bun run scripts/og-bracket.ts   # against production
//   bun run scripts/og-bracket.ts                            # against localhost:3000

import { copyFile } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.OG_URL ?? "http://localhost:3000";
const OG = "app/opengraph-image.png";
const TWITTER = "app/twitter-image.png";

// Use a pre-installed Chromium when one is provided (e.g. CI images that set
// PLAYWRIGHT_EXECUTABLE_PATH); otherwise fall back to Playwright's own download.
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}/og-bracket`, { waitUntil: "networkidle" });
  // Wait for the flags to lock in (slot odds resolve, sprite paints).
  await page.waitForSelector('svg[viewBox="0 0 1000 1000"]');
  await page.waitForTimeout(2500);
  // Drop the global header so only the bracket fills the 1200×630 frame.
  await page.evaluate(() => document.querySelector("header")?.remove());
  await page.screenshot({
    path: OG,
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await copyFile(OG, TWITTER);
  console.log(`Wrote ${OG} and ${TWITTER} from ${BASE}/og-bracket`);
} finally {
  await browser.close();
}
