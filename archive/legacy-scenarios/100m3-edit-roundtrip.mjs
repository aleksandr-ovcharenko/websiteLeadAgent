// V3.7 Phase 13 — CMS single-source proof for NextTrade: change values via
// the CMS API (the exact endpoints Studio calls), reload showcase, assert
// render, revert. 100m3 has no products; covers the reviews block instead.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const GATEWAY = 'http://localhost:3000';
const SITE = 'cmubtwrze0001st9q0eps7yua';
const TOKEN = 'ohdq5cir';
const M = 'V37EDIT';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(ok ? '  PASS' : '  FAIL', name, '|', detail); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${GATEWAY}/api/auth/login`, { data: { email: 'admin@minsk.local', password: 'admin123' }, headers: { Origin: GATEWAY } });
const api = (m, path, body) => page.request.fetch(`${GATEWAY}${path}`, { method: m, data: body, headers: { 'Content-Type': 'application/json', Origin: GATEWAY, Referer: `${GATEWAY}/studio/${SITE}` } });

const bundle = () => api('GET', `/api/cms/sites/${SITE}`).then((r) => r.json());
const showcaseText = async (path = '') => {
  await page.goto(`${GATEWAY}/showcase/${TOKEN}/${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return page.locator('body').innerText();
};

const before = await bundle();
const home = before.pages.find((p) => p.isHomepage);
const svc = before.services[0];
const proj = before.projects[0];
const reviewsPage = before.pages.find((p) => p.slug === 'otzyvy' || (p.blocks || []).some((b) => b.type === 'reviews'));
const reviewsBlocks = reviewsPage ? JSON.parse(JSON.stringify(reviewsPage.blocks)) : null;
const rb = reviewsBlocks?.find((b) => b.type === 'reviews');
const newsItem = before.news[0];
const topMenu = before.menu.filter((m) => !m.parentId);
const menuItem = topMenu.find((m) => m.label === 'Проекты') || topMenu[0];
const menuTree = topMenu.map((m) => ({
  label: m.id === menuItem.id ? `${M} ${m.label}` : m.label,
  pageId: m.pageId, url: m.url, targetType: m.targetType, target: m.target,
  visible: m.visible, showInHeader: m.showInHeader, showInFooter: m.showInFooter,
  showOnHomepage: m.showOnHomepage,
  children: (before.menu.filter((c) => c.parentId === m.id)).map((c) => ({
    label: c.label, pageId: c.pageId, url: c.url, targetType: c.targetType, target: c.target,
    visible: c.visible, showInHeader: c.showInHeader, showInFooter: c.showInFooter, showOnHomepage: c.showOnHomepage,
  })),
}));
const menuTreeOrig = topMenu.map((m) => ({
  label: m.label,
  pageId: m.pageId, url: m.url, targetType: m.targetType, target: m.target,
  visible: m.visible, showInHeader: m.showInHeader, showInFooter: m.showInFooter,
  showOnHomepage: m.showOnHomepage,
  children: (before.menu.filter((c) => c.parentId === m.id)).map((c) => ({
    label: c.label, pageId: c.pageId, url: c.url, targetType: c.targetType, target: c.target,
    visible: c.visible, showInHeader: c.showInHeader, showInFooter: c.showInFooter, showOnHomepage: c.showOnHomepage,
  })),
}));
const orig = {
  homeBlocks: JSON.parse(JSON.stringify(home.blocks)),
  svcTitle: svc.title,
  projExcerpt: proj.excerpt,
  reviewsBlocks,
  reviewsHeading: rb?.heading,
  newsTitle: newsItem.title,
  phone: before.site.siteSettings.phone,
  menuLabel: menuItem.label,
};

// ---- apply edits -----------------------------------------------------------
const blocks = JSON.parse(JSON.stringify(home.blocks));
const bHero = blocks.find((b) => b.type === 'hero');
if (bHero) bHero.title = `${M} главная`;

const edits = [
  ['page blocks', () => api('PUT', `/api/cms/sites/${SITE}/pages/${home.id}`, { blocks })],
  ['service title', () => api('PUT', `/api/cms/sites/${SITE}/services/${svc.id}`, { title: `${M} ${orig.svcTitle}` })],
  ['project excerpt', () => api('PUT', `/api/cms/sites/${SITE}/projects/${proj.id}`, { excerpt: `${M} ${orig.projExcerpt || ''}`.trim() })],
  ...(rb ? [['reviews block heading', () => {
    rb.heading = `${M} ${orig.reviewsHeading || 'Отзывы'}`;
    return api('PUT', `/api/cms/sites/${SITE}/pages/${reviewsPage.id}`, { blocks: reviewsBlocks });
  }]] : []),
  ['news title', () => api('PUT', `/api/cms/sites/${SITE}/news/${newsItem.id}`, { title: `${M} ${orig.newsTitle}` })],
  ['settings phone', () => api('POST', `/api/cms/sites/${SITE}/settings`, { phone: '+375 29 000-00-00' })],
  ['menu label', () => api('PUT', `/api/cms/sites/${SITE}/menu`, { items: menuTree })],
];
for (const [name, fn] of edits) {
  const r = await fn();
  check(`edit applied: ${name}`, r.ok(), `HTTP ${r.status()}`);
}

// ---- assert render ----------------------------------------------------------
const homeText = await showcaseText('');
if (bHero) check('homepage hero renders edit', homeText.includes(`${M} главная`), 'hero title');

// service detail: find its slug-backed route via backing page sourceUrl
const svcPage = before.pages.find((p) => p.sourceUrl && p.sourceUrl === svc.sourceUrl);
const svcPath = svcPage?.slug || svc.slug;
const svcDetail = await showcaseText(svcPath);
check('service detail renders edit', svcDetail.includes(`${M} ${orig.svcTitle}`), `route /${svcPath}`);

if (rb) {
  const revText = await showcaseText(reviewsPage.slug);
  check('reviews block renders edit', revText.includes(`${M} ${orig.reviewsHeading || 'Отзывы'}`), `route /${reviewsPage.slug}`);
}

const newsSlug = newsItem.slug;
const newsDetail = await showcaseText(newsSlug);
check('news detail renders edit', newsDetail.includes(`${M} ${orig.newsTitle}`), `route /${newsSlug}`);

check('menu label renders edit', homeText.includes(`${M} ${orig.menuLabel}`), 'nav label');
check('phone renders edit', homeText.includes('000-00-00'), 'contacts phone');

// ---- revert ------------------------------------------------------------------
const reverts = [
  ['page blocks', () => api('PUT', `/api/cms/sites/${SITE}/pages/${home.id}`, { blocks: orig.homeBlocks })],
  ['service title', () => api('PUT', `/api/cms/sites/${SITE}/services/${svc.id}`, { title: orig.svcTitle })],
  ['project excerpt', () => api('PUT', `/api/cms/sites/${SITE}/projects/${proj.id}`, { excerpt: orig.projExcerpt })],
  ...(rb ? [['reviews block heading', () => api('PUT', `/api/cms/sites/${SITE}/pages/${reviewsPage.id}`, { blocks: orig.reviewsBlocks })]] : []),
  ['news title', () => api('PUT', `/api/cms/sites/${SITE}/news/${newsItem.id}`, { title: orig.newsTitle })],
  ['settings phone', () => api('POST', `/api/cms/sites/${SITE}/settings`, { phone: orig.phone })],
  ['menu label', () => api('PUT', `/api/cms/sites/${SITE}/menu`, { items: menuTreeOrig })],
];
for (const [name, fn] of reverts) {
  const r = await fn();
  check(`reverted: ${name}`, r.ok(), `HTTP ${r.status()}`);
}
const afterText = await showcaseText('');
check('revert renders', !afterText.includes(M), 'no marker left on homepage');

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} roundtrip checks passed`);
const outIdx = process.argv.findIndex((a) => a.startsWith('--json='));
const OUT = outIdx >= 0 ? process.argv[outIdx].split('=')[1] : 'data/redesign/v37/100m3/edit-roundtrip.json';
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), site: SITE, results }, null, 2));
process.exit(pass === results.length ? 0 : 1);
