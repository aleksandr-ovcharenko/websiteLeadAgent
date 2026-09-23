import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const out = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c25-creative-breakout/selected/recordings';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: out, size: { width: 1280, height: 720 } }
});
const page = await ctx.newPage();
await page.goto('http://localhost:4002/selected/render/c25-selected.html', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);
// Move cursor across hero to reveal photo
for (let x = 300; x <= 900; x += 60) {
  await page.mouse.move(x, 400, { steps: 3 });
  await page.waitForTimeout(80);
}
// Scroll down through process and portfolio
for (let y = 0; y <= 2400; y += 160) {
  await page.mouse.wheel(0, 160);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(1000);
await ctx.close();
await browser.close();
console.log('Video saved to', out);
