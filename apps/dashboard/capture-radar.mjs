import { chromium } from 'playwright';
import path from 'node:path';

const base = 'http://localhost:3004';
const outDir = '/home/aleks/dev/websiteLeadAgent/apps/dashboard';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
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

await page.waitForSelector('text=All eligible', { timeout: 20000 });
await page.click('text=All eligible');
await page.waitForTimeout(400);

// Wait for the table and search for mrs
await page.waitForSelector('input[placeholder="Search leads…"]', { timeout: 20000 });
await page.fill('input[placeholder="Search leads…"]', 'mrs');
await page.waitForTimeout(1500);

await page.screenshot({ path: path.join(outDir, 'radar-mrs-table.png'), fullPage: false });

const row = await page.locator('tr:has-text("mrs.by")').first();
await row.click();
await page.waitForTimeout(1200);

await page.screenshot({ path: path.join(outDir, 'radar-mrs-lead-detail.png'), fullPage: false });

// Open Activity Console to show audit events
const activityButton = await page.locator('text=Activity Console').first();
if (await activityButton.isVisible().catch(() => false)) {
  await activityButton.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'radar-mrs-activity-console.png'), fullPage: false });
}

await browser.close();
console.log('Screenshots saved:', outDir);
