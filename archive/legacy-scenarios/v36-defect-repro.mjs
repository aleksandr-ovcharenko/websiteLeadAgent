// V3.6 Phase 0 — defect reproduction: screenshots + machine-readable defect list.
//   node scripts/v36-defect-repro.mjs [--after]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GATEWAY = 'http://localhost:3000';
const SITE_ID = 'cmuazd8v900011kiu4bp2hsnf';
const VARIANT_TOKEN = 'muazd8vjzv4j';
const AFTER = process.argv.includes('--after');
const OUT = join(process.cwd(), 'data/redesign/v36', AFTER ? 'after' : 'before');

const defects = [];
const add = (id, area, desc, origin) => defects.push({ id, area, desc, origin });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${GATEWAY}/api/auth/login`, {
  data: { email: 'admin@minsk.local', password: 'admin123' },
  headers: { Origin: GATEWAY },
});

// ---- Showcase: text pollution + hardcoded copy checks ----
await page.goto(`${GATEWAY}/showcase/${VARIANT_TOKEN}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.screenshot({ path: join(OUT, 'showcase-desktop.png'), fullPage: true });
const body = await page.locator('body').innerText();
const checks = [
  ['chrome-pollution', /Лишэн\s+X\s*\+375|Лишэн\s+Лишэн/i.test(body), 'company name + phone chrome inside content'],
  ['hardcoded-otm', /ОТМ\.?\s*0\.000/i.test(body), 'hardcoded drawing annotation ОТМ. 0.000'],
  ['hardcoded-list', /ЛИСТ\s*0?\d/i.test(body), 'hardcoded drawing annotation ЛИСТ 01'],
  ['hardcoded-fig', /Рис\.\s*0?\d/i.test(body), 'hardcoded figure caption Рис. 01'],
  ['english-cta', /Let's discuss your project|Contact us|Our services|View projects/i.test(body), 'hardcoded English customer copy'],
  ['generic-category', /\bCompany\b/.test(body), 'fallback project category "Company"'],
];
for (const [id, bad, desc] of checks) if (bad) add(id, 'showcase', desc, null);

// Entity-level check: a generic "Услуги" service would appear as a service
// card name (not as the editable section <h2>, which is legitimate content).
const serviceCardNames = await page.locator('.service-item__name').allInnerTexts();
if (serviceCardNames.some((n) => n.trim() === 'Услуги')) {
  add('generic-service', 'showcase', 'generic index page imported as Service entity', 'extractFromCrawl classifyPage maps /services index → services[]');
}
// Authoritative entity check via CMS API — no generic/duplicate entities.
const cmsData = await page.request.get(`${GATEWAY}/api/cms/sites/${SITE_ID}`);
if (cmsData.ok()) {
  const d = await cmsData.json();
  if ((d.services || []).some((s) => /^услуги$/i.test((s.title || '').trim()))) {
    add('generic-service-entity', 'cms', 'generic "Услуги" Service row in CMS', 'extractFromCrawl classifyPage maps /services index → services[]');
  }
  if ((d.projects || []).some((p) => /портфолио/i.test(p.title || '') || /^company$/i.test(p.category || ''))) {
    add('generic-project-entity', 'cms', 'index-derived or Company-category Project row in CMS', 'extractFromCrawl classifyPage maps /portfolio → projects[]');
  }
}

// nav hierarchy: does Услуги dropdown exist with children?
const navItems = await page.locator('header a, nav a').allInnerTexts();
add('obs-nav-items', 'showcase', `header nav labels: ${JSON.stringify(navItems.slice(0, 12))}`, null);

// ---- Studio: pages list + editors ----
await page.goto(`${GATEWAY}/studio/${SITE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Dashboard', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

const sidebarBtn = async (label) => {
  const btn = page.locator(`button:has-text("${label}")`).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(1200); return true; }
  return false;
};

await sidebarBtn('Pages');
await page.waitForTimeout(800);
const pagesBody = await page.locator('body').innerText();
add('obs-pages-list', 'cms', 'pages list contains homepage: ' + /\/|index|homepage/i.test(pagesBody) + ', homepage badge: ' + /homepage/i.test(pagesBody), null);
await page.screenshot({ path: join(OUT, 'cms-pages.png') });

// open homepage editor — the homepage row carries the Homepage badge (path '/').
const indexRow = page.locator('tr', { hasText: /homepage/i }).first();
if (await indexRow.count()) {
  await indexRow.locator('td').first().locator('button, a').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'cms-page-editor-index.png') });
  const edText = await page.locator('body').innerText();
  add('obs-index-editor', 'cms', 'editor opened, has blocks: ' + /hero|services|projects|contacts/i.test(edText), null);
  // deep link: reload — does editor survive?
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const afterReload = await page.locator('body').innerText();
  const lost = /Dashboard|Страницы/.test(afterReload) && !/Hero|Slug/i.test(afterReload);
  if (lost) add('deep-link-lost', 'cms', 'page reload drops editor back to dashboard (no deep link)', 'studio SPA state not synced to URL');
  else add('obs-deep-link', 'cms', 'editor survived page reload (deep link works)', null);
  await page.goBack().catch(() => {});
}

// services list
await page.goto(`${GATEWAY}/studio/${SITE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await sidebarBtn('Services');
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'cms-services.png') });
// (entity-level generic-service check is done via the CMS API above — the
// screen's own "Услуги" heading would be a false positive)

// open first service editor, check description pollution
const svcRow = page.locator('tr, [class*="row"], li').filter({ hasText: /монолит/i }).first();
if (await svcRow.count()) {
  await svcRow.locator('button, a, td').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'cms-service-detail.png') });
  const svcEd = await page.locator('body').innerText();
  if (/Лишэн\s+X|\+375 29 673/.test(svcEd)) add('service-chrome-desc', 'cms', 'service description contains company+phone chrome', 'buildSourceDocuments mainEl=header → mainText=chrome → graph description=chrome');
  await page.goto(`${GATEWAY}/studio/${SITE_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
}

// projects list
await sidebarBtn('Projects');
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'cms-projects.png') });
const projText = await page.locator('body').innerText();
if (/Портфолио строительной компании/i.test(projText)) add('portfolio-index-as-project', 'cms', '/portfolio index imported as Project entity', 'extractFromCrawl classifyPage maps /portfolio → projects[]');
if (/\bCompany\b/.test(projText)) add('project-category-company', 'cms', 'project category "Company" fallback', 'inferIndustry() default');

// project detail — cover image check (logo as cover?)
const projRow = page.locator('tr, [class*="row"], li').filter({ hasText: /Промышленный|бассейн|каркасн/i }).first();
if (await projRow.count()) {
  await projRow.locator('button, a, td').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'cms-project-detail.png') });
  const imgs = await page.locator('img').all();
  for (const im of imgs) {
    const src = await im.getAttribute('src');
    if (src && /removebg|logo|150x150/i.test(src)) add('logo-as-cover', 'cms', `logo/icon used as project cover: ${src.slice(-60)}`, 'pickCoverImage accepts 150x150 logo (threshold >120)');
  }
}

// contacts
await page.goto(`${GATEWAY}/studio/${SITE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await sidebarBtn('Contacts');
await page.waitForTimeout(800);
await page.screenshot({ path: join(OUT, 'cms-contacts.png') });
const cText = await page.locator('body').innerText();
if (/Лишэн\s+Лишэн|Лишэн\s+X/.test(cText)) add('contact-address-pollution', 'cms', 'address field contains company chrome', 'extractFromCrawl: contactsPage.text.slice as address');

// mobile nav
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await mctx.newPage();
await mp.goto(`${GATEWAY}/showcase/${VARIANT_TOKEN}`, { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(2000);
await mp.screenshot({ path: join(OUT, 'showcase-mobile.png'), fullPage: false });
const mBody = await mp.locator('body').innerText();
add('obs-mobile-nav', 'showcase', 'mobile nav labels: ' + JSON.stringify((await mp.locator('header a, nav a, button').allInnerTexts()).slice(0, 10)), null);

await browser.close();
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'defects.json'), JSON.stringify({ at: new Date().toISOString(), phase: AFTER ? 'after' : 'before', defects }, null, 2));
console.log(JSON.stringify(defects, null, 1));
