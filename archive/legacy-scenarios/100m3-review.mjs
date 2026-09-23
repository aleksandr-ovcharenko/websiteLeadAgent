// V3.7 Phase 14 (100m3) — independent Playwright review of the 100m3 showcase:
// render every route class, capture screenshots, flag empty pages, console
// errors, and broken images.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const BASE = 'http://localhost:3000/showcase/ohdq5cir';
const OUTDIR = 'data/redesign/v37/100m3/shots';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(ok ? '  PASS' : '  FAIL', name, '|', detail); };

const ROUTES = [
  { path: '', name: 'home' },
  { path: 'proekty', name: 'projects-index' },
  { path: 'galery', name: 'gallery-index' },
  { path: 'galery-page-2', name: 'gallery-pagination' },
  { path: 'odnoetazhnie-doma', name: 'project-category' },
  { path: 'odnoetazhnie-doma-page-2', name: 'category-pagination' },
  { path: 'otzyvy', name: 'reviews-index' },
  { path: '46-otzyv-13.html', name: 'review-detail' },
  { path: 'news', name: 'news-index' },
  { path: '149-akciya-ot-kompanii-100-kubov.html-1', name: 'news-detail' },
  { path: 'stroitelstvo', name: 'services-index' },
  { path: '136-vozvedenie-fundamenta.html', name: 'project-detail' },
  { path: '18-stroitelstvo-fundamentov.html', name: 'service-detail' },
  { path: 'partnery.html', name: 'about-partners' },
  { path: 'dokumenty.html', name: 'legal-documents' },
  { path: 'about.html', name: 'about' },
  { path: 'definitely-not-a-page-zzz', name: 'not-found' },
];

await mkdir(OUTDIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

for (const r of ROUTES) {
  const errors = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  const resp = await page.goto(`${BASE}/${r.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const status = resp?.status() || 0;
  const text = await page.locator('body').innerText().catch(() => '');
  const badImgs = await page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:')).map((i) => i.src.slice(0, 120))
  );
  await page.screenshot({ path: `${OUTDIR}/${r.name}.png`, fullPage: false });

  const expect404 = r.name === 'not-found';
  check(`${r.name}: status`, expect404 ? status === 404 : status === 200, `HTTP ${status}`);
  check(`${r.name}: content`, expect404 ? /не найден|not found|404/i.test(text) : text.trim().length > 200, `${text.trim().length} chars`);
  check(`${r.name}: no js errors`, errors.length === 0, errors[0] || 'clean');
  check(`${r.name}: images`, badImgs.length === 0, badImgs[0] || 'ok');
}

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} review checks passed`);
await writeFile('data/redesign/v37/100m3/playwright-review.json', JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
process.exit(pass === results.length ? 0 : 1);
