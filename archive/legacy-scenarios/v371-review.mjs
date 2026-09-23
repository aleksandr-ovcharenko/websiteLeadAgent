// V3.7.1 Phase 13 — bounded Playwright review.
// Viewports 320→1440 + 200% zoom; interaction + visual assertions.
// Output: data/redesign/v371/playwright-results.json + shots under v371/after/.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.REVIEW_BASE || 'http://localhost:3336/showcase/mubop32v09uy';
const OUT = path.join(ROOT, 'data/redesign/v371');
const SHOTS = path.join(OUT, 'after');

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'news-index', path: '/blog' },
  { name: 'news-detail-1', path: '/prodexpo2024' },
  { name: 'news-detail-2', path: '/otkritiemagazina' },
  { name: 'news-detail-3', path: '/bonetiilari' },
  { name: 'protender', path: '/protender' },
  { name: 'services-index', path: '/uslugi' },
  { name: 'service-detail', path: '/dizain-proekt-magazina' },
  { name: 'service-detail-2', path: '/servisnoe_obsluzhivanie' },
  { name: 'projects-index', path: '/proektyi' },
  { name: 'project-detail', path: '/bakaleya_mogilev_mogilev' },
  { name: 'products-index', path: '/stellazhi-torgovyie' },
  { name: 'product-detail', path: '/micromarket' },
  { name: 'contacts', path: '/contacts' },
  { name: 'not-found', path: '/definitely-not-a-page-zzz', expect404: true },
];
const VIEWPORTS = [320, 390, 768, 1024, 1366, 1440];

const results = [];
const record = (scope, check, pass, detail = '') => {
  results.push({ scope, check, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${scope}: ${check}${detail ? ' | ' + detail : ''}`);
};

await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch();

for (const r of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // A deliberate-404 document logs a resource-404 for the page itself —
    // that is the expected signal, not a script error.
    if (r.expect404 && /Failed to load resource.*404/.test(m.text())) return;
    errors.push(m.text());
  });

  const resp = await page.goto(BASE + r.path, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForTimeout(2200);
  const status = resp?.status() ?? 0;
  record(r.name, 'status', r.expect404 ? status === 404 : status === 200, `HTTP ${status}`);

  const text = await page.evaluate(() => document.body?.innerText || '');
  if (r.expect404) {
    record(r.name, '404 content', /ничего нет|не найден|404/i.test(text), `${text.length} chars`);
  } else {
    record(r.name, 'content', text.length > 200, `${text.length} chars`);
    record(r.name, 'no technical payload', !/li_type|li_mask|mail@example|t-form|dataLayer/.test(text), '');
    record(r.name, 'no glued lede', !/Проблемы Решения|Решения Мы превращаем/.test(text), '');
  }
  record(r.name, 'no js errors', errors.length === 0, errors[0]?.slice(0, 120) || 'clean');

  const broken = await page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  record(r.name, 'images', broken.length === 0, broken[0]?.slice(0, 90) || `${broken.length} broken`);

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  record(r.name, 'no horizontal overflow', !overflow, '');

  await page.screenshot({ path: path.join(SHOTS, `${r.name}-1440.png`), fullPage: true });
  await ctx.close();
}

// ── responsive sweep on the heaviest routes ──────────────────────────────────
for (const r of [ROUTES[0], ROUTES[5], ROUTES[1]]) {
  for (const w of VIEWPORTS.filter((v) => v !== 1440)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE + r.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    record(`${r.name}@${w}`, 'no horizontal overflow', !overflow, '');
    record(`${r.name}@${w}`, 'no js errors', errors.length === 0, errors[0]?.slice(0, 100) || 'clean');
    await page.screenshot({ path: path.join(SHOTS, `${r.name}-${w}.png`), fullPage: true });
    await ctx.close();
  }
}

// 200% zoom ≈ 1440 CSS-px at zoom 2 → emulate with deviceScaleFactor + viewport
{
  const ctx = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  record('home@200zoom', 'no horizontal overflow', !overflow, '');
  await page.screenshot({ path: path.join(SHOTS, 'home-zoom200.png'), fullPage: true });
  await ctx.close();
}

// ── interaction assertions ───────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);

  // every homepage entity preview is a real anchor with a scoped href
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && h !== '#'));
  const dead = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h === '#' || h === ''));
  record('home', 'entity links exist', links.length >= 10, `${links.length} anchors`);
  record('home', 'no dead/hash links', dead.length === 0, `${dead.length} dead`);

  // click first homepage entity preview → destination route + title
  const first = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/showcase/"][href$="protender"], .services a[href], .collection a[href]');
    return a ? { href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 60) } : null;
  });
  if (first) {
    await page.goto(new URL(first.href, BASE).href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const t = await page.evaluate(() => document.body.innerText);
    record('nav-click', 'destination has content', t.length > 200, `${first.href}`);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    record('nav-click', 'browser back returns home', page.url().includes(BASE) && !page.url().endsWith('protender'), page.url());
  } else {
    record('nav-click', 'entity anchor found', false, 'no clickable entity preview');
  }

  // keyboard: tab to a news row, Enter opens it
  await page.goto(BASE + '/blog', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const newsLink = await page.evaluate(() => {
    const a = document.querySelector('a.collection__link[href]');
    return a?.getAttribute('href') || null;
  });
  if (newsLink) {
    const href = new URL(newsLink, BASE).href;
    await page.focus(`a[href="${newsLink}"]`);
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('href'));
    record('keyboard', 'news row focusable', focused === newsLink, focused || 'none');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    record('keyboard', 'Enter opens news detail', page.url() === href, page.url());
  } else {
    record('keyboard', 'news anchor found', false, 'none on /blog');
  }
  await ctx.close();
}

await browser.close();

const fails = results.filter((r) => !r.pass);
const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  viewports: VIEWPORTS,
  zoomChecked: true,
  total: results.length,
  passed: results.length - fails.length,
  failed: fails.length,
  results,
};
await writeFile(path.join(OUT, 'playwright-results.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.passed}/${report.total} checks passed`);
process.exit(fails.length ? 1 : 0);
