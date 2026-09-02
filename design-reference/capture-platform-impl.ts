import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('design-reference/screenshots', { recursive: true });

async function capture() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3004/');

  await page.fill('input[type="email"]', 'admin@minsk.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:3004/');
  await page.waitForLoadState('networkidle');

  for (const [w, h, name] of [
    [1440, 900, 'platform-impl-1440'],
    [1024, 768, 'platform-impl-1024']
  ] as [number, number, string][]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    const path = `design-reference/screenshots/${name}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log('Implementation screenshot:', path);
  }
  await browser.close();
}

capture().catch((e) => { console.error(e); process.exit(1); });
