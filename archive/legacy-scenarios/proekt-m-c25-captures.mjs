import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c25-creative-breakout/selected/screenshots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function capture(url, name, scroll=0) {
  for (const [n, vp] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      if (scroll) await page.evaluate(s => window.scrollTo(0, s), scroll);
      await page.screenshot({ path: join(out, `${name}-${n}.png`), fullPage: false });
      console.log('captured', name, n);
    } catch (e) { console.error('fail', name, n, e.message); }
    await ctx.close();
  }
}

await capture('http://localhost:4002/concept-a/', 'concept-a');
await capture('http://localhost:4002/concept-b/', 'concept-b');
await capture('http://localhost:4002/concept-c/', 'concept-c');
await capture('http://localhost:4002/selected/render/c25-selected.html', 'c25-selected-hero', 0);
await capture('http://localhost:4002/selected/render/c25-selected.html', 'c25-selected-process', 800);
await capture('http://localhost:4002/selected/render/c25-selected.html', 'c25-selected-portfolio', 2200);

await browser.close();
