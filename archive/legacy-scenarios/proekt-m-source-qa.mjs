import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const out = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation/source/qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
for (const [name, vp] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  try {
    await page.goto('https://proekt-m.by/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
    console.log('captured source', name);
  } catch (e) { console.error(name, e.message); }
  await ctx.close();
}
await browser.close();
