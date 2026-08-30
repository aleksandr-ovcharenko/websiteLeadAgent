import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const OUT = 'docs/screenshots/product-qa';

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results: { name: string; ok: boolean; note?: string }[] = [];

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    // Login if needed
    const heading = await page.locator('h1:has-text("Platform Admin")').first();
    if (await heading.isVisible().catch(() => false)) {
      await page.click('button:has-text("Sign in")');
      await page.waitForSelector('text=WebsiteLeadAgent', { timeout: 5000 });
    }

    // Hub
    await page.waitForSelector('text=Business website generation platform', { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, '01-hub.png'), fullPage: true });
    results.push({ name: 'hub', ok: true });

    // Factory
    await page.click('nav button:has-text("Factory")');
    await page.waitForSelector('text=Generation pipeline', { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, '02-factory.png'), fullPage: true });
    results.push({ name: 'factory', ok: true });

    // Forge
    await page.click('nav button:has-text("Forge")');
    await page.waitForSelector('text=Manage generated sites', { timeout: 10000 });
    await page.screenshot({ path: path.join(OUT, '03-forge.png'), fullPage: true });
    results.push({ name: 'forge', ok: true });

    // Radar
    await page.click('nav button:has-text("Radar")');
    await page.waitForSelector('text=Loading leads…', { state: 'hidden', timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '04-radar.png'), fullPage: true });
    results.push({ name: 'radar', ok: true });

    // Studio from first site in Forge
    await page.click('nav button:has-text("Forge")');
    await page.waitForTimeout(500);
    const openCms = await page.locator('button:has-text("Open CMS")').first();
    const hasSites = await openCms.isVisible().catch(() => false);
    let studioPage = page;
    let studioSiteId: string | undefined;
    if (hasSites) {
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }),
        openCms.click(),
      ]);
      studioPage = newPage;
      await studioPage.waitForLoadState('domcontentloaded');
      await studioPage.waitForTimeout(1000);
      studioSiteId = studioPage.url().split('/studio/')[1];
      await studioPage.screenshot({ path: path.join(OUT, '05-studio.png'), fullPage: true });
      results.push({ name: 'studio', ok: true });

      // Site switcher
      const siteSwitcher = await studioPage.locator('header button:has-text("Switch site")').first();
      const canSwitch = await siteSwitcher.isVisible().catch(() => false);
      if (canSwitch) {
        await siteSwitcher.click();
        await studioPage.waitForTimeout(500);
        await studioPage.screenshot({ path: path.join(OUT, '06-site-switcher.png'), fullPage: false });
        await studioPage.keyboard.press('Escape');
      }

      // Showcase
      const showcaseBtn = await studioPage.locator('button:has-text("Open Showcase")').first();
      if (await showcaseBtn.isVisible().catch(() => false)) {
        const [showcase] = await Promise.all([
          studioPage.context().waitForEvent('page', { timeout: 5000 }),
          showcaseBtn.click(),
        ]);
        await showcase.waitForLoadState('domcontentloaded');
        await showcase.waitForTimeout(1000);
        await showcase.screenshot({ path: path.join(OUT, '07-showcase.png'), fullPage: true });
        const showcaseUrl = showcase.url();
        const previewToken = showcaseUrl.split('/showcase/')[1]?.split('/')[0];
        if (previewToken) {
          results.push({ name: 'showcase', ok: true, note: `previewToken=${previewToken}` });
        } else {
          results.push({ name: 'showcase', ok: true, note: showcaseUrl });
        }
        await showcase.close();
      } else {
        results.push({ name: 'showcase', ok: false, note: 'Open Showcase button not visible' });
      }
    } else {
      results.push({ name: 'studio', ok: false, note: 'No sites in Forge to open Studio' });
      results.push({ name: 'showcase', ok: false, note: 'Studio not reached' });
    }

    // Console check
    const logs: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') logs.push(msg.text()); });

    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors: logs }, null, 2));
  } catch (e: any) {
    await page.screenshot({ path: path.join(OUT, '99-error.png'), fullPage: true });
    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ error: e.message }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
