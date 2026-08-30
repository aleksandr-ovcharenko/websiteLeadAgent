import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const OUT = 'docs/screenshots/discovery-qa';

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results: { name: string; ok: boolean; note?: string }[] = [];
  const consoleErrors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const heading = await page.locator('h1:has-text("Platform Admin")').first();
    if (await heading.isVisible().catch(() => false)) {
      await page.click('button:has-text("Sign in")');
      await page.waitForSelector('text=Leads', { timeout: 10000 });
    }

    // Go to Radar
    await page.goto(`${BASE}/radar`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Provider switching UI
    await page.click('button:has-text("New discovery")');
    await page.waitForSelector('text=Source', { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('select[name="provider"]') !== null && document.querySelector('select[name="provider"] option') !== null, { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('select[name="topic"] option[value="construction"]') !== null, { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, '01-new-discovery.png'), fullPage: true });
    const providerOptions = await page.locator('select[name="provider"] option, select[name="topic"] option').allTextContents();
    const has2gis = providerOptions.some(t => t.includes('2GIS'));
    const hasManual = providerOptions.some(t => t.includes('Manual'));
    const hasYandex = providerOptions.some(t => t.includes('Yandex'));
    results.push({ name: 'provider-list', ok: has2gis && hasManual && hasYandex, note: `2gis=${has2gis}, manual=${hasManual}, yandex=${hasYandex}` });

    // 2. Topic preset pre-fills query
    await page.locator('select[name="topic"]').selectOption('construction');
    await page.waitForTimeout(200);
    const queryValue = await page.locator('input[name="query"]').inputValue();
    results.push({ name: 'topic-preset', ok: queryValue.includes('строительные'), note: queryValue });

    // 3. Manual provider: add and qualify leads
    await page.locator('select[name="provider"]').selectOption('manual');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '02-manual-provider.png'), fullPage: true });
    await page.fill('textarea[placeholder*="garantk.by"]', 'garantk.by\nExample Co;https://example.by');
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/discovery/runs') && r.request().method() === 'POST', { timeout: 15000 }),
      page.click('button:has-text("Start discovery")'),
    ]);
    const status = response.status();
    results.push({ name: 'manual-start', ok: status < 300, note: `status=${status}` });

    // 4. Discovery history appears
    await page.click('button:has-text("History")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, '03-discovery-history.png'), fullPage: false });
    const hasManualRow = await page.locator('text=manual').first().isVisible().catch(() => false);
    results.push({ name: 'history-list', ok: hasManualRow });

    // 5. Duplicate pre-fills form
    await page.click('button:has-text("Duplicate")');
    await page.waitForSelector('text=New discovery', { timeout: 3000 });
    await page.screenshot({ path: path.join(OUT, '04-duplicate.png'), fullPage: true });
    const dupProvider = await page.locator('select[name="provider"]').inputValue().catch(() => '');
    const dupQuery = await page.locator('input[name="query"]').inputValue().catch(() => '');
    results.push({ name: 'duplicate-prefill', ok: dupProvider === 'manual', note: `${dupProvider}:${dupQuery}` });
    await page.click('button:has-text("Cancel")');

    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors }, null, 2));
  } catch (e: any) {
    await page.screenshot({ path: path.join(OUT, '99-error.png'), fullPage: true });
    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ error: e.message, consoleErrors }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
