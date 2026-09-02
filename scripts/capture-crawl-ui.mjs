import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = 'http://localhost:3000';
const outDir = path.resolve(__dirname, '../apps/dashboard');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${base}/radar`);
await page.evaluate(() => fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@minsk.local', password: 'admin123' }),
  credentials: 'include'
}));

await page.goto(`${base}/radar`);
await page.waitForSelector('input[placeholder="Search leads…"]', { timeout: 20000 });
await page.fill('input[placeholder="Search leads…"]', 'mapid');
await page.waitForTimeout(1200);

const row = page.locator('tr:has-text("mapid.by")').first();
await row.click();
await page.waitForTimeout(1200);

await page.screenshot({ path: path.join(outDir, 'mapid-lead-detail.png'), fullPage: false });

const viewCrawl = page.locator('text=View crawl').first();
await viewCrawl.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
if (await viewCrawl.isVisible().catch(() => false)) {
  await viewCrawl.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, 'mapid-crawl-viewer.png'), fullPage: false });
}

await browser.close();
console.log('Screenshots saved:', outDir);
