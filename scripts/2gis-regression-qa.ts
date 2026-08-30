import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const BASE = 'http://localhost:3000';
const OUT = 'docs/screenshots/2gis-regression';

interface RunSummary {
  operationRunId: string;
  discoveryRunId: string;
  query: string;
  location: string;
  limit: number;
  maxPages: number;
  collected: number;
  created: number;
  duplicates: number;
  consoleText: string;
}

async function startDiscovery(page: any, query: string) {
  await page.goto(`${BASE}/radar`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.click('button:has-text("New discovery")');
  await page.waitForSelector('select[name="provider"]', { timeout: 3000 });
  await page.locator('select[name="provider"]').selectOption('dgis');
  await page.fill('input[name="query"]', query);
  await page.locator('input[placeholder="Минск"]').fill('Минск');
  await page.locator('input[type="number"]').first().fill('50');
  await page.locator('input[type="number"]').nth(1).fill('5');

  const [response] = await Promise.all([
    page.waitForResponse((r: any) => r.request().method() === 'POST' && r.url().includes('/api/operations')),
    page.click('button:has-text("Start discovery")'),
  ]);

  const json = await response.json().catch(() => null);
  return json?.run?.id as string;
}

async function waitForResult(page: any, runId: string) {
  // Wait for the operation to reach a terminal state via polling the API
  for (let i = 0; i < 60; i++) {
    const data: any = await page.evaluate(async (id: string) => {
      const r = await fetch(`/api/operations/${id}`, { credentials: 'include' });
      return r.json();
    }, runId);
    const op = data?.run || data;

    if (op?.status === 'SUCCESS' || op?.status === 'FAILED' || op?.status === 'CANCELLED') {
      const consoleText = (await page.locator('[data-testid="operation-console"]').textContent().catch(() => '')) || '';
      return { ...op, consoleText };
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('Operation did not finish in time');
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => { consoleErrors.push(err.message); });

  const results: RunSummary[] = [];

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const heading = await page.locator('h1:has-text("Platform Admin")').first();
    if (await heading.isVisible().catch(() => false)) {
      await page.click('button:has-text("Sign in")');
      await page.waitForSelector('text=Leads', { timeout: 10000 });
    }

    for (const query of ['строительство домов', 'строительные компании', 'ремонт квартир']) {
      await page.goto(`${BASE}/radar`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const runId = await startDiscovery(page, query);
      const op = await waitForResult(page, runId);
      await page.screenshot({ path: path.join(OUT, `${query.replace(/\s/g, '-')}.png`), fullPage: true });

      results.push({
        operationRunId: runId,
        discoveryRunId: op?.result?.discoveryRunId || op?.id,
        query,
        location: 'Минск',
        limit: 50,
        maxPages: 5,
        collected: op?.result?.collected ?? -1,
        created: op?.result?.created ?? -1,
        duplicates: op?.result?.duplicates ?? -1,
        consoleText: op?.consoleText || '',
      });
    }

    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors }, null, 2));
  } catch (e: any) {
    await page.screenshot({ path: path.join(OUT, '99-error.png'), fullPage: true });
    await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify({ error: e.message, consoleErrors }, null, 2));
    throw e;
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
