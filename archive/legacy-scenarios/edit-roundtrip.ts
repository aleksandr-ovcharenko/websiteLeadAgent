import { chromium, Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'screenshots', 'roundtrip');

const SITES = [
  {
    id: 'cmtdkqiu50004crwd529otns8',
    token: '8e25ix7c',
    name: 'Garant Kachestva',
    original: 'Гарант Качества',
    qa: 'Гарант Качества [QA]'
  },
  {
    id: 'cmtecurjw00034ikcns2j61e4',
    token: 'ze6f3z0v',
    name: 'Test Builder',
    original: 'Test Builder Local',
    qa: 'Test Builder Local [QA]'
  }
];

async function login(page: Page) {
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'admin@minsk.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('h1:has-text("WebsiteLeadAgent")', { timeout: 10000 });
}

async function setCompanyName(page: Page, siteId: string, value: string) {
  const res = await page.evaluate(async ({ siteId, value }) => {
    const r = await fetch(`/api/cms/sites/${siteId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ companyName: value })
    });
    return { status: r.status, text: await r.text() };
  }, { siteId, value });
  if (res.status >= 400) throw new Error(`settings update failed: ${res.status} ${res.text}`);
  console.log(`set companyName for ${siteId} -> ${value} (${res.status})`);
}

async function waitForShowcase(page: Page) {
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount || 0) > 0 || document.body.innerText.trim().length > 0, { timeout: 5000 });
  await page.waitForTimeout(800);
}

async function shot(page: Page, name: string) {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log('roundtrip screenshot', p);
  return p;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', (err) => { logs.push(`PAGEERROR: ${err.message}`); });
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`HTTP ${r.status()} ${r.url()}`); });

  await login(page);
  const results: any[] = [];

  for (const s of SITES) {
    console.log(`\n--- ${s.name} ---`);

    // Baseline
    await page.goto(`http://localhost:3000/showcase/${s.token}`);
    await waitForShowcase(page);
    const before = await shot(page, `${s.token}-before`);

    // Apply QA name
    await setCompanyName(page, s.id, s.qa);
    await page.goto(`http://localhost:3000/showcase/${s.token}`);
    await waitForShowcase(page);
    const after = await shot(page, `${s.token}-after-edit`);

    // Verify visible
    const title = await page.title();
    const header = await page.evaluate(() => {
      const el = document.querySelector('header a');
      return el ? (el as any).innerText : '';
    });
    const company = await page.evaluate(() => (window as any).__CMS__?.company?.name);
    results.push({ site: s.name, token: s.token, title, header, company });

    // Restore
    await setCompanyName(page, s.id, s.original);
    await page.goto(`http://localhost:3000/showcase/${s.token}`);
    await waitForShowcase(page);
    const restored = await shot(page, `${s.token}-after-restore`);

    console.log(`  before: ${before}\n  after:  ${after}\n  restored: ${restored}`);
  }

  await browser.close();

  const logPath = join(OUT, 'roundtrip-results.json');
  await writeFile(logPath, JSON.stringify({ ok: true, results, logs }, null, 2));
  console.log('\nresults', logPath);
}

run().catch(e => { console.error(e); process.exit(1); });
