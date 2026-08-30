// @ts-nocheck
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const OUT = join(process.cwd(), 'docs', 'screenshots', 'navigation-qa');
const BASE = 'http://localhost:3000';
const TOKEN = '8e25ix7c';
const START = `${BASE}/showcase/${TOKEN}`;

type TestResult = {
  name: string;
  ok: boolean;
  url: string;
  hash: string;
  sectionInViewport?: boolean;
  error?: string;
  screenshot: string;
};

async function inViewport(page: any, id: string) {
  return await page.evaluate((sel: string) => {
    const el = document.getElementById(sel);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  }, id);
}

async function clickAndVerify(page: any, testName: string, selector: any, expectedUrl: string, expectedHash?: string, expectedSection?: string): Promise<TestResult> {
  const screenshot = join(OUT, `${testName.replace(/[^a-z0-9]/gi, '_')}.png`);
  try {
    const [resp] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => null),
      selector.click()
    ]);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(300);
    if (expectedSection) {
      await page.waitForSelector(`#${expectedSection}`, { state: 'visible', timeout: 10000 });
    }
    const url = page.url();
    const hash = new URL(url).hash;
    const sectionInViewport = expectedSection ? await inViewport(page, expectedSection) : undefined;
    const ok = url.includes(expectedUrl) && (!expectedHash || hash === expectedHash);
    await page.screenshot({ path: screenshot, fullPage: false });
    return { name: testName, ok, url, hash, sectionInViewport, screenshot };
  } catch (e: any) {
    await page.screenshot({ path: screenshot, fullPage: false });
    return { name: testName, ok: false, url: page.url(), hash: new URL(page.url()).hash, error: e.message, screenshot };
  }
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const logs: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg: any) => {
    if (msg.type() === 'error') logs.push(`CONSOLE_ERROR: ${msg.text()}`);
  });
  page.on('pageerror', (err: any) => { logs.push(`PAGEERROR: ${err.message}`); });
  page.on('response', (r: any) => {
    if (r.status() >= 400) failedRequests.push(`FAILED ${r.status()} ${r.url()}`);
  });

  const results: TestResult[] = [];

  // Start at homepage
  await page.goto(START, { waitUntil: 'networkidle', timeout: 20000 });
  await page.screenshot({ path: join(OUT, '01-home.png'), fullPage: false });

  // Header clicks from homepage
  const headerClicks = [
    ['О компании', `${START}/#about`, '#about', 'about'],
    ['Услуги', `${START}/#services`, '#services', 'services'],
    ['Объекты', `${START}/#projects`, '#projects', 'projects'],
    ['Новости', `${START}/#news`, '#news', 'news'],
    ['Контакты', `${START}/#contacts`, '#contacts', 'contacts'],
  ] as const;

  for (const [label, expectedUrl, expectedHash, section] of headerClicks) {
    const link = page.locator('a', { hasText: label }).first();
    results.push(await clickAndVerify(page, `header-${label}`, link, expectedUrl, expectedHash, section));
  }

  // Footer Вакансии
  const footerVacancies = page.locator('a', { hasText: 'Вакансии' }).last();
  results.push(await clickAndVerify(page, 'footer-vacancies', footerVacancies, `${START}/#vacancies`, '#vacancies', 'vacancies'));

  // Service detail → back to services
  const serviceLink = page.locator('a[href*="/services/"]').first();
  if (await serviceLink.count() > 0) {
    const href = await serviceLink.getAttribute('href');
    const serviceDetailUrl = new URL(href || '', START).href;
    await page.goto(serviceDetailUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(OUT, '02-service-detail.png'), fullPage: false });

    const backToServices = page.locator('a', { hasText: 'Назад к услугам' });
    results.push(await clickAndVerify(page, 'service-back-to-services', backToServices, `${START}/#services`, '#services', 'services'));

    // Cross navigation from detail
    const headerProjects = page.locator('a', { hasText: 'Объекты' }).first();
    results.push(await clickAndVerify(page, 'service-detail-to-projects', headerProjects, `${START}/#projects`, '#projects', 'projects'));
  }

  // News detail → back to news
  const newsLink = page.locator('a[href*="/news/"]').first();
  if (await newsLink.count() > 0) {
    const href = await newsLink.getAttribute('href');
    const newsDetailUrl = new URL(href || '', START).href;
    await page.goto(newsDetailUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(OUT, '03-news-detail.png'), fullPage: false });

    const backToNews = page.locator('a', { hasText: 'Назад к новостям' });
    results.push(await clickAndVerify(page, 'news-back-to-news', backToNews, `${START}/#news`, '#news', 'news'));
  }

  // Project detail → back to projects
  const projectLink = page.locator('a[href*="/projects/"]').first();
  if (await projectLink.count() > 0) {
    const href = await projectLink.getAttribute('href');
    const projectDetailUrl = new URL(href || '', START).href;
    await page.goto(projectDetailUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(OUT, '04-project-detail.png'), fullPage: false });

    const backToProjects = page.locator('a', { hasText: 'Назад к объектам' });
    results.push(await clickAndVerify(page, 'project-back-to-projects', backToProjects, `${START}/#projects`, '#projects', 'projects'));
  }

  // ─── CMS NAV audit from homepage ─────────────────────────────────────────────
  const nav = await page.evaluate(() => (window as any).__CMS__?.NAV || []);
  results.push({ name: 'cms-nav-вакансии-header-off', ok: !!nav.find((n: any) => n.target === 'VACANCIES' && !n.showInHeader), url: page.url(), hash: new URL(page.url()).hash, screenshot: '' });
  results.push({ name: 'cms-nav-вакансии-footer-on', ok: !!nav.find((n: any) => n.target === 'VACANCIES' && n.showInFooter), url: page.url(), hash: new URL(page.url()).hash, screenshot: '' });
  results.push({ name: 'cms-nav-вакансии-homepage-on', ok: !!nav.find((n: any) => n.target === 'VACANCIES' && n.showOnHomepage), url: page.url(), hash: new URL(page.url()).hash, screenshot: '' });
  results.push({ name: 'cms-nav-order', ok: nav.every((n: any, i: number, a: any[]) => i === 0 || (n.sortOrder ?? i) >= (a[i - 1].sortOrder ?? (i - 1))), url: page.url(), hash: new URL(page.url()).hash, screenshot: '' });

  // ─── Collection CTAs from homepage ───────────────────────────────────────────
  const allCtas = [
    ['Все новости', `${START}/news`, 'news'],
    ['Все объекты', `${START}/projects`, 'projects'],
    ['Все услуги', `${START}/services`, 'services'],
  ] as const;
  for (const [label, expectedUrl, section] of allCtas) {
    const cta = page.locator('a', { hasText: new RegExp(label) }).first();
    if (await cta.count() > 0) {
      await page.goto(START, { waitUntil: 'networkidle' });
      await page.screenshot({ path: join(OUT, '01-home.png'), fullPage: false });
      results.push(await clickAndVerify(page, `cta-${label}`, cta, expectedUrl, undefined, undefined));
      const backLink = page.locator('a', { hasText: 'Назад к главной' }).first();
      results.push(await clickAndVerify(page, `${label}-back-to-home`, backLink, `${START}/#${section}`, `#${section}`, section));
    } else {
      results.push({ name: `cta-missing-${label}`, ok: false, url: page.url(), hash: new URL(page.url()).hash, error: `CTA "${label}" not found`, screenshot: '' });
    }
  }

  // ─── Detail from collection returns to collection, not home ──────────────────
  await page.goto(`${START}/news`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(OUT, '05-news-collection.png'), fullPage: false });
  const collectionNewsLink = page.locator('a[href*="/news/"]').first();
  if (await collectionNewsLink.count() > 0) {
    const collectionDetailHref = await collectionNewsLink.getAttribute('href') || '';
    const collectionDetailUrl = new URL(collectionDetailHref, START).href;
    const detailSlug = new URL(collectionDetailUrl).pathname.split('/').pop() || 'unknown';
    const homeDetailUrl = `${START}/news/${detailSlug}?returnTo=home`;

    // From collection
    await page.goto(collectionDetailUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(OUT, '06-news-detail-from-collection.png'), fullPage: false });
    const backFromCollection = page.locator('a', { hasText: 'Назад к новостям' });
    results.push(await clickAndVerify(page, 'news-detail-back-to-collection', backFromCollection, `${START}/news`, undefined, 'news'));

    // Explicit returnTo=home
    await page.goto(homeDetailUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(OUT, '07-news-detail-from-home.png'), fullPage: false });
    const backFromHome = page.locator('a', { hasText: 'Назад к новостям' });
    results.push(await clickAndVerify(page, 'news-detail-back-to-home', backFromHome, `${START}/#news`, '#news', 'news'));

    // Cross-page header navigation from detail
    const headerServices = page.locator('a', { hasText: 'Услуги' }).first();
    results.push(await clickAndVerify(page, 'detail-header-to-services', headerServices, `${START}/#services`, '#services', 'services'));
  }

  await browser.close();

  const ok = results.every(r => r.ok) && logs.length === 0 && failedRequests.length === 0;
  const report = {
    ok,
    token: TOKEN,
    startUrl: START,
    results,
    logs,
    failedRequests,
  };

  const path = join(OUT, 'navigation-qa-results.json');
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log('Navigation QA done:', path);
  console.log('Results:', results.map(r => `${r.name} ${r.ok ? '✓' : '✗'} ${r.url} ${r.hash}`).join('\n'));
  if (!ok) {
    console.log('Logs:', logs);
    console.log('Failed requests:', failedRequests);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
