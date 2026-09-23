// V3.7 Phase 14 — independent Playwright review of the NextTrade showcase:
// render every route class, capture screenshots, flag empty pages, console
// errors, and broken images.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const BASE = 'http://localhost:3336/showcase/aqtanswx';
const OUTDIR = 'data/redesign/v37/nexttrade/shots';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(ok ? '  PASS' : '  FAIL', name, '|', detail); };

const ROUTES = [
  { path: '', name: 'home' },
  { path: 'proektyi', name: 'projects-index' },
  { path: 'blog', name: 'news-index' },
  { path: 'stellazhi-torgovyie', name: 'products-index' },
  { path: 'pristennyie-vitrinyi', name: 'products-index-2' },
  { path: 'torgovoe-oborudovanie', name: 'products-page' },
  { path: 'micromarket', name: 'product-detail' },
  { path: 'promovitrina', name: 'product-detail-2' },
  { path: encodeURIComponent('стеллаж-пристенный-хлебный'), name: 'product-variant' },
  { path: 'prodexpo2024', name: 'news-detail' },
  { path: 'protender', name: 'service-detail' },
  { path: 'bakaleya_mogilev_mogilev', name: 'project-detail' },
  { path: 'contacts', name: 'contacts' },
  { path: 'definitely-not-a-page-zzz', name: 'not-found' },
];

await mkdir(OUTDIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

for (const r of ROUTES) {
  const errors = [];
  const badImgs = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  const resp = await page.goto(`${BASE}/${r.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const status = resp?.status() || 0;
  const text = await page.locator('body').innerText().catch(() => '');
  const imgCheck = await page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:')).map((i) => i.src.slice(0, 120))
  );
  badImgs.push(...imgCheck.slice(0, 5));
  await page.screenshot({ path: `${OUTDIR}/${r.name}.png`, fullPage: false });

  const expect404 = r.name === 'not-found';
  check(`${r.name}: status`, expect404 ? status === 404 : status === 200, `HTTP ${status}`);
  check(`${r.name}: content`, expect404 ? /не найден|not found|404/i.test(text) : text.trim().length > 200, `${text.trim().length} chars`);
  check(`${r.name}: no js errors`, errors.length === 0, errors[0] || 'clean');
  check(`${r.name}: images`, badImgs.length === 0, badImgs[0] || `${imgCheck.length} broken`);
}

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} review checks passed`);
await writeFile('data/redesign/v37/nexttrade/playwright-review.json', JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
process.exit(0);
