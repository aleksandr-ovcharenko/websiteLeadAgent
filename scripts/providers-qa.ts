import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const OUT = 'docs/screenshots/providers-qa';

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

    // 1. Open Radar providers
    await page.goto(`${BASE}/radar/providers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, '01-providers-overview.png'), fullPage: true });

    await page.waitForSelector('text=Discovery providers', { timeout: 5000 });
    const has2gis = await page.locator('text=2GIS').first().isVisible().catch(() => false);
    const hasManual = await page.locator('text=Manual Import').first().isVisible().catch(() => false);
    const hasOsm = await page.locator('text=OSM / Overpass').first().isVisible().catch(() => false);
    const hasDdg = await page.locator('text=DuckDuckGo HTML').first().isVisible().catch(() => false);
    const hasYandex = await page.locator('text=Yandex').first().isVisible().catch(() => false);
    const loaded = has2gis && hasManual && hasOsm && hasDdg && hasYandex;
    results.push({ name: 'providers-loaded', ok: loaded, note: `2gis=${has2gis}, manual=${hasManual}, osm=${hasOsm}, ddg=${hasDdg}, yandex=${hasYandex}` });

    // 2. 2GIS card shows Ready and has actions
    const card2gis = await page.locator('div', { hasText: '2GIS' }).first();
    const ready2gis = await page.locator('text=READY').first().isVisible().catch(() => false);
    results.push({ name: '2gis-ready', ok: ready2gis });

    // 3. Configure provider modal
    await page.click('button:has-text("Configure")');
    await page.waitForSelector('text=Configure', { timeout: 3000 });
    await page.screenshot({ path: path.join(OUT, '02-provider-config.png'), fullPage: true });
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
    results.push({ name: 'configure-modal', ok: true });

    // 4. Test a provider
    await page.click('button:has-text("Test")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, '03-provider-tested.png'), fullPage: true });
    const tested = await page.locator('text=Last test').first().isVisible().catch(() => false);
    results.push({ name: 'provider-test', ok: tested });

    // 5. New Discovery preselected from provider
    await page.click('button:has-text("New discovery")', { hasText: 'New discovery' });
    await page.waitForSelector('text=Source', { timeout: 3000 });
    await page.screenshot({ path: path.join(OUT, '04-new-discovery-preselected.png'), fullPage: true });
    const providerValue = await page.locator('select[name="provider"]').inputValue().catch(() => '');
    results.push({ name: 'new-discovery-preselected', ok: providerValue !== '', note: providerValue });
    await page.click('button:has-text("Cancel")');

    // 6. Unconfigured provider has Configure CTA
    await page.goto(`${BASE}/radar/providers`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("+ New discovery")');
    await page.waitForSelector('text=Source', { timeout: 3000 });
    await page.locator('select[name="provider"]').selectOption('yandex');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '05-unconfigured-cta.png'), fullPage: true });
    const hasCta = await page.locator('a:has-text("Configure provider")').isVisible().catch(() => false);
    results.push({ name: 'unconfigured-cta', ok: hasCta });
    await page.click('button:has-text("Cancel")');

    // 7. Search presets page
    await page.goto(`${BASE}/radar/presets`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Search presets', { timeout: 5000 });
    await page.screenshot({ path: path.join(OUT, '06-presets.png'), fullPage: true });
    const hasPresets = await page.locator('text=Construction').first().isVisible().catch(() => false);
    results.push({ name: 'presets-loaded', ok: hasPresets });

    // 8. Create preset
    await page.click('button:has-text("+ Create preset")');
    await page.waitForSelector('text=Create preset', { timeout: 3000 });
    await page.fill('input[type="text"]', 'Test Preset QA');
    await page.locator('button:has-text("Create")').last().click();
    await page.waitForTimeout(1000);
    const hasTestPreset = await page.locator('text=Test Preset QA').first().isVisible().catch(() => false);
    results.push({ name: 'create-preset', ok: hasTestPreset });

    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors }, null, 2));
  } catch (e: any) {
    await page.screenshot({ path: path.join(OUT, '99-error.png'), fullPage: true });
    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ error: e.message, consoleErrors }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
