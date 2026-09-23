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

async function capture(view, name) {
  await page.goto(`${base}/radar?view=${view}`);
  await page.waitForSelector('text=All sites', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
}

await capture('all', 'radar-view-all.png');
await capture('review', 'radar-view-review.png');
await capture('generation', 'radar-view-generation.png');

// Test a lower filter and a lead detail from the generation view
await page.goto(`${base}/radar?view=generation`);
await page.waitForSelector('text=All sites', { timeout: 20000 });

await page.fill('input[placeholder="Search leads…"]', 'mapid');
await page.waitForTimeout(800);

const row = await page.locator('tr:has-text("mapid.by")').first();
const hasRow = await row.isVisible().catch(() => false);
if (hasRow) {
  await row.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'radar-lead-detail.png'), fullPage: false });
}

// Open Activity Console to show audit events
const activityButton = await page.locator('text=Activity Console').first();
if (await activityButton.isVisible().catch(() => false)) {
  await activityButton.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'radar-activity-console.png'), fullPage: false });
}

await browser.close();
console.log('Screenshots saved:', outDir);
