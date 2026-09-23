import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'data/experiments/mapid/screenshots';
await mkdir(OUT, { recursive: true });

const targets = [
  { name: 'source', url: 'https://mapid.by/' },
  { name: 'v1', url: 'http://localhost:3336/showcase/mapid-v1-9b560819' },
  { name: 'v2', url: 'http://localhost:3336/showcase/mapid-v2-85a0669a' },
];

const browser = await chromium.launch({ headless: true });

for (const t of targets) {
  for (const { device, viewport } of [
    { device: 'desktop', viewport: { width: 1440, height: 900 } },
    { device: 'mobile', viewport: { width: 390, height: 844 } },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1000);
    const path = join(OUT, `${t.name}-${device}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(path);
    await context.close();
  }
}

await browser.close();
