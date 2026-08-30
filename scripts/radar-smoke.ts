import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const OUT = 'docs/screenshots/radar-smoke';

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results: { name: string; ok: boolean; note?: string }[] = [];
  const consoleErrors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => { consoleErrors.push(err.message); });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const heading = await page.locator('h1:has-text("Platform Admin")').first();
    if (await heading.isVisible().catch(() => false)) {
      await page.click('button:has-text("Sign in")');
      await page.waitForSelector('text=Leads', { timeout: 10000 });
    }

    await page.goto(`${BASE}/radar`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '01-radar-overview.png'), fullPage: true });
    results.push({ name: 'radar-loaded', ok: await page.locator('text=Discovery').first().isVisible().catch(() => false) });

    const hasLeads = await page.locator('table tbody tr').first().isVisible().catch(() => false);
    results.push({ name: 'leads-table', ok: hasLeads, note: hasLeads ? 'table visible' : 'no leads' });

    if (hasLeads) {
      await page.locator('table tbody tr').first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, '02-lead-detail.png'), fullPage: true });
      results.push({ name: 'lead-detail', ok: await page.locator('text=Qualification completeness').first().isVisible().catch(() => false) });
    }

    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors }, null, 2));
    console.log(JSON.stringify({ results, consoleErrors }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
