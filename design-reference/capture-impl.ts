import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('design-reference/screenshots', { recursive: true });

async function capture() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  for (const [w, h, name] of [
    [1440, 900, '1440'],
    [768, 1024, '768'],
    [390, 844, '390'],
  ] as [number, number, string][]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
    const path = `design-reference/screenshots/impl-${name}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log('Implementation screenshot:', path);
  }
  await browser.close();
}

capture().catch((e) => { console.error(e); process.exit(1); });
