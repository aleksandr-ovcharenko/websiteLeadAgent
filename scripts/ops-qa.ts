import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const OUT = 'docs/screenshots/ops-qa';

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

    // 1. Unified Radar shell at /radar
    await page.goto(`${BASE}/radar`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, '01-radar-leads.png'), fullPage: true });
    const unifiedShell = await page.locator('text=Discovery providers').isVisible().catch(() => false);
    results.push({ name: 'radar-unified-shell', ok: unifiedShell });

    // 2. Provider page shows operation console on Test
    await page.goto(`${BASE}/radar/providers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const testButton = await page.locator('button:has-text("Test")').first();
    await testButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, '02-provider-test-running.png'), fullPage: true });
    const consoleVisible = await page.locator('text=Operation').first().isVisible().catch(() => false)
      || await page.locator('text=RUNNING').first().isVisible().catch(() => false);
    results.push({ name: 'provider-test-console', ok: consoleVisible });

    // wait for completion
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT, '03-provider-test-complete.png'), fullPage: true });
    const finalStatus = await page.locator('text=SUCCESS').first().isVisible().catch(() => false)
      || await page.locator('text=FAILED').first().isVisible().catch(() => false);
    results.push({ name: 'provider-test-final', ok: finalStatus });

    // 3. New discovery shows operation console
    await page.goto(`${BASE}/radar/providers`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("+ New discovery")');
    await page.waitForSelector('text=Source', { timeout: 3000 });
    await page.locator('select[name="provider"]').selectOption('manual');
    await page.waitForTimeout(300);
    await page.fill('textarea[name="manualEntries"]', 'QA Test Site;https://example-qa-test.by');
    await page.click('button:has-text("Start discovery")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, '04-discovery-running.png'), fullPage: true });
    const discoveryConsole = await page.locator('text=Discovery run').first().isVisible().catch(() => false)
      || await page.locator('text=RUNNING').first().isVisible().catch(() => false);
    results.push({ name: 'discovery-console-running', ok: discoveryConsole });

    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT, '05-discovery-complete.png'), fullPage: true });
    const discoveryDone = await page.locator('text=SUCCESS').first().isVisible().catch(() => false)
      || await page.locator('text=FAILED').first().isVisible().catch(() => false);
    results.push({ name: 'discovery-console-final', ok: discoveryDone });

    // 4. Lead action runs an operation
    await page.goto(`${BASE}/radar`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const scoreButton = await page.locator('button:has-text("Score")').first();
    await scoreButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, '06-lead-operation.png'), fullPage: true });
    const leadConsole = await page.locator('text=RECALCULATE_SCORE').first().isVisible().catch(() => false)
      || await page.locator('text=RUNNING').first().isVisible().catch(() => false)
      || await page.locator('text=SUCCESS').first().isVisible().catch(() => false);
    results.push({ name: 'lead-operation-console', ok: leadConsole });

    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors }, null, 2));
  } catch (e: any) {
    await page.screenshot({ path: path.join(OUT, '99-error.png'), fullPage: true });
    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ error: e.message, consoleErrors }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
