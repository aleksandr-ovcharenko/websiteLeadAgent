// Route conformance suite for editorial-architecture-v1.
// Asserts rendered CONTENT identity per route — HTTP 200 alone is never enough.
// Usage: node scripts/route-conformance.mjs [--json=data/redesign/v361/route-conformance.json]
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const BASE = 'http://localhost:3000/showcase/3fx5dct2';
const outIdx = process.argv.findIndex((a) => a.startsWith('--json='));
const OUT = outIdx >= 0 ? process.argv[outIdx].split('=')[1] : 'data/redesign/v361/route-conformance.json';

const ROUTES = [
  { path: '', expect: { kind: 'HOME', title: /.+/ }, marker: '.hero' },
  { path: 'licenses', expect: { kind: 'PAGE', title: /Лицензии/i }, marker: '.certs__grid' },
  { path: 'faq', expect: { kind: 'PAGE', title: /FAQ|Вопросы|Частые/i } },
  { path: 'services', expect: { kind: 'COLLECTION', title: /Услуги/i }, marker: '.collection' },
  { path: 'portfolio', expect: { kind: 'COLLECTION', title: /Портфолио|Проекты|Объекты/i }, marker: '.collection' },
  { path: 'contacts', expect: { kind: 'PAGE', title: /Контакты/i } },
  { path: 'services/monolit', expect: { kind: 'SERVICE_DETAIL', title: /Монолит/i } },
  { path: 'portfolio/basseyn-robinson-club', expect: { kind: 'PROJECT_DETAIL', title: /Robinson|Робинсон|бассейн/i } },
  { path: 'definitely-not-a-page-xyz', expect: { kind: 'NOT_FOUND', status: 404, title: /не найдена|404/i } },
];

const results = [];
const check = (route, name, ok, detail) => {
  results.push({ route, name, ok, detail });
  console.log(ok ? '  PASS' : '  FAIL', `[${route || '/'}]`, name, detail ? `| ${detail}` : '');
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let homeH1 = '';
for (const r of ROUTES) {
  const errors = [];
  const failed = [];
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  page.removeAllListeners('requestfailed');
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The document request itself logging "Failed to load resource: 404" on a
    // deliberately-404 route is expected — not an app error.
    if (r.expect.status === 404 && m.text().includes('Failed to load resource')) return;
    errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on('requestfailed', (rq) => { if (new URL(rq.url()).origin === 'http://localhost:3000') failed.push(rq.url()); });

  const url = `${BASE}/${r.path}`;
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const status = resp?.status();
  const expectedStatus = r.expect.status || 200;
  check(r.path, 'status', status === expectedStatus, `got ${status}, want ${expectedStatus}`);

  const routeType = await page.locator('main[data-route], #main[data-route]').first().getAttribute('data-route').catch(() => null)
    || await page.locator('main').first().getAttribute('data-route').catch(() => null)
    || (await page.locator('.hero').count() ? 'HOME' : null);
  check(r.path, 'route-kind', routeType === r.expect.kind, `got ${routeType}, want ${r.expect.kind}`);

  const h1 = await page.locator('h1').first().innerText().catch(() => '');
  if (!r.path) homeH1 = h1;
  check(r.path, 'h1-identity', r.expect.title.test(h1), `h1="${h1.slice(0, 60)}"`);
  if (r.path) {
    check(r.path, 'no-homepage-h1', h1 !== homeH1, homeH1 ? `homeH1="${homeH1.slice(0, 40)}"` : '');
  }

  if (r.marker) {
    const n = await page.locator(r.marker).count();
    check(r.path, 'route-marker', n > 0, `${r.marker} count=${n}`);
  }

  // Footer ordering invariant: .footer must be the last element in <main>/<body> flow.
  const footerLast = await page.evaluate(() => {
    const f = document.querySelector('footer.footer, footer[data-route-footer]');
    if (!f) return 'missing';
    let el = f;
    while (el.nextElementSibling && !el.nextElementSibling.matches('script,style,template')) el = el.nextElementSibling;
    return el === f ? 'ok' : `after-footer:${el.tagName}.${el.className}`;
  });
  check(r.path, 'footer-last', footerLast === 'ok', footerLast);

  // hidden/aria-expanded consistency for every disclosure trigger.
  const ariaMismatch = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('[aria-controls]').forEach((t) => {
      const c = document.getElementById(t.getAttribute('aria-controls'));
      if (!c) return;
      const expanded = t.getAttribute('aria-expanded');
      if (expanded === 'true' && c.hidden) bad.push(`expanded+hidden:${c.id}`);
      const cs = getComputedStyle(c);
      const visible = !c.hidden && !c.hasAttribute('inert') && c.getAttribute('aria-hidden') !== 'true'
        && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
      if (expanded === 'false' && visible) bad.push(`collapsed+visible:${c.id}`);
    });
    return bad;
  });
  check(r.path, 'hidden-aria-sync', ariaMismatch.length === 0, ariaMismatch.join(';') || 'ok');

  // No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(r.path, 'no-x-overflow', overflow <= 1, `overflow=${overflow}px`);

  check(r.path, 'no-js-errors', errors.length === 0, errors.join(' | ') || 'clean');
  check(r.path, 'no-failed-requests', failed.length === 0, failed.join(' | ') || 'clean');
}

// Nested services menu: disclosure opens, children render, Escape closes.
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const disc = page.locator('button.header__disclosure').first();
await disc.click();
const subVisible = await page.locator('.header__sub:not([hidden])').count();
const kidCount = await page.locator('.header__sub:not([hidden]) .header__sublink').count();
check('nav', 'submenu-opens', subVisible === 1 && kidCount >= 4, `visible=${subVisible} children=${kidCount}`);
await page.keyboard.press('Escape');
const afterEsc = await page.locator('.header__sub:not([hidden])').count();
check('nav', 'escape-closes', afterEsc === 0, `open-after-esc=${afterEsc}`);

await browser.close();

const failedChecks = results.filter((r) => !r.ok);
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, total: results.length, passed: results.length - failedChecks.length, failed: failedChecks.length, results }, null, 2));
console.log(`\n${results.length - failedChecks.length}/${results.length} passed → ${OUT}`);
process.exit(failedChecks.length ? 1 : 0);
