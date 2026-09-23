// V3.5 product-integration browser assertions.
// Drives Forge → Studio → Showcase with a real session and records
// evidence screenshots + assertion results under data/redesign/v35/.
//
//   node scripts/v35-browser-assertions.mjs

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const RENDERER = process.env.RENDERER_URL || 'http://localhost:3336';
const SITE_ID = 'cmuazd8v900011kiu4bp2hsnf';
const VARIANT_TOKEN = 'muazd8vjzv4j';
const SITE_TOKEN = '3fx5dct2';
const OUT = join(process.cwd(), 'data/redesign/v35');

const results = [];
const failedRequests = [];
const consoleErrors = [];

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail ?? null });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('requestfailed', (r) => failedRequests.push({ url: r.url(), err: r.failure()?.errorText, page: page.url() }));
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push({ url: r.url(), status: r.status(), page: page.url() }); });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ text: m.text(), page: page.url() }); });

// ---------- login (API login sets the session cookie in this context) ----------
const loginResp = await page.request.post(`${GATEWAY}/api/auth/login`, {
  data: { email: 'admin@minsk.local', password: 'admin123' },
  headers: { Origin: GATEWAY, 'Content-Type': 'application/json' },
});
check('auth.login', loginResp.ok(), `status ${loginResp.status()}`);

// ---------- Forge ----------
await page.goto(`${GATEWAY}/forge`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Lishen', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
const lishenCard = page.locator('text=Lishen').first();
check('forge.lishen-card', await lishenCard.count() > 0);
const origLink = page.locator('a[href*="lishen.by"]').first();
check('forge.original-url-link', await origLink.count() > 0, await origLink.getAttribute('href').catch(() => null));
check('forge.no-qa-fixtures', await page.locator('text=V34 QA').count() === 0);

// thumbnail: image loads OR explicit empty state (no broken img)
const card = lishenCard.locator('xpath=ancestor::*[self::article or self::li or contains(@class,"card") or contains(@class,"Card")][1]').first();
const imgs = page.locator('img');
const imgCount = await imgs.count();
let brokenImgs = 0;
for (let i = 0; i < imgCount; i++) {
  const im = imgs.nth(i);
  if (await im.isVisible()) {
    const ok = await im.evaluate((el) => el.complete && el.naturalWidth > 0);
    if (!ok) brokenImgs++;
  }
}
check('forge.no-broken-images', brokenImgs === 0, `${imgCount} imgs, ${brokenImgs} broken`);

// "Open" is a button → window.open; click it and capture the popup target.
let showcaseTarget = null;
try {
  await lishenCard.click();
  await page.waitForTimeout(1000);
  const openBtn = page.locator('button:has-text("Open preferred")').first();
  if (await openBtn.count()) {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 8000 }),
      openBtn.click(),
    ]);
    showcaseTarget = popup.url();
    await popup.close();
  }
} catch (e) { showcaseTarget = `error: ${String(e).slice(0, 80)}`; }
check('forge.open-showcase-link', !!showcaseTarget && showcaseTarget.includes(`/showcase/${VARIANT_TOKEN}`), showcaseTarget);
await page.screenshot({ path: join(OUT, 'forge.png'), fullPage: false }).catch(() => {});

// ---------- Studio ----------
await page.goto(`${GATEWAY}/studio/${SITE_ID}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Lishen', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(2000);
const dashText = await page.locator('#cms-main, main, body').first().innerText().catch(() => '');
check('studio.dashboard-loaded', /Lishen|lishen/i.test(dashText));
check('studio.dashboard-original-url', /lishen\.by/i.test(dashText));
check('studio.dashboard-counts', /15|15 pages|Pages/i.test(dashText));
await page.screenshot({ path: join(OUT, 'cms/dashboard.png'), fullPage: false });

const sidebarBtn = async (label) => {
  const btn = page.locator(`button:has-text("${label}")`).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(1200); return true; }
  return false;
};

// Navigation
await sidebarBtn('Navigation');
await page.waitForLoadState('domcontentloaded').catch(() => {});
const navText = await page.locator('body').innerText();
const navLabels = ['Главная', 'Услуги', 'Контакты', 'Портфолио', 'FAQ'];
const navFound = navLabels.filter((l) => navText.includes(l));
check('studio.navigation-items', navFound.length >= 4, `found: ${navFound.join(', ')}`);
check('studio.navigation-no-isVisible-crash', !/isVisible|error|TypeError/i.test(navText));
await page.screenshot({ path: join(OUT, 'cms/navigation.png'), fullPage: false });

// Media
await sidebarBtn('Media');
await page.waitForLoadState('domcontentloaded').catch(() => {});
await page.waitForTimeout(1500);
const mediaImgs = page.locator('#cms-main img, main img');
const mCount = await mediaImgs.count();
let mBroken = 0;
for (let i = 0; i < mCount; i++) {
  const im = mediaImgs.nth(i);
  if (await im.isVisible().catch(() => false)) {
    const ok = await im.evaluate((el) => el.complete && el.naturalWidth > 0).catch(() => false);
    if (!ok) mBroken++;
  }
}
check('studio.media-thumbnails', mCount > 0 && mBroken === 0, `${mCount} imgs, ${mBroken} broken`);
await page.screenshot({ path: join(OUT, 'cms/media.png'), fullPage: false });

// Projects
await sidebarBtn('Projects');
await page.waitForLoadState('domcontentloaded').catch(() => {});
const projText = await page.locator('body').innerText();
check('studio.projects-real', /монолит|строительств|благоустр|объект/i.test(projText));
await page.screenshot({ path: join(OUT, 'cms/projects.png'), fullPage: false });

// Services
await sidebarBtn('Services');
await page.waitForLoadState('domcontentloaded').catch(() => {});
const svcText = await page.locator('body').innerText();
check('studio.services-real', /монолит|строительств|благоустр|проект/i.test(svcText));
await page.screenshot({ path: join(OUT, 'cms/services.png'), fullPage: false });

// ---------- Showcase (variant + site token) ----------
for (const [label, token] of [['variant', VARIANT_TOKEN], ['site', SITE_TOKEN]]) {
  const r = await page.goto(`${GATEWAY}/showcase/${token}`, { waitUntil: 'domcontentloaded' });
  check(`showcase.${label}-http`, r && r.status() === 200, `status ${r?.status()}`);
  const body = await page.locator('body').innerText();
  check(`showcase.${label}-content`, /Lishen|Лишень|Услуги|Портфолио/i.test(body));
}
// nav uses CMS menu labels + anchors
const navHtml = await page.locator('header, nav').first().innerText().catch(() => '');
check('showcase.nav-from-cms', /Услуги|Главная/i.test(navHtml));
const anchors = await page.locator('a[href*="#"]').count();
check('showcase.anchor-links', anchors > 0, `${anchors} anchor links`);

// showcase images not broken
await page.goto(`${GATEWAY}/showcase/${VARIANT_TOKEN}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const sImgs = page.locator('img');
const sCount = await sImgs.count();
let sBroken = 0;
const brokenSrcs = [];
for (let i = 0; i < sCount; i++) {
  const im = sImgs.nth(i);
  if (await im.isVisible().catch(() => false)) {
    const ok = await im.evaluate((el) => el.complete && el.naturalWidth > 0).catch(() => false);
    if (!ok) { sBroken++; brokenSrcs.push(await im.getAttribute('src')); }
  }
}
check('showcase.no-broken-images', sBroken === 0, `${sCount} imgs, ${sBroken} broken: ${brokenSrcs.join(', ')}`);

await page.screenshot({ path: join(OUT, 'showcase/desktop.png'), fullPage: true });

const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mpage = await mctx.newPage();
await mpage.goto(`${RENDERER}/showcase/${VARIANT_TOKEN}`, { waitUntil: 'domcontentloaded' });
await mpage.waitForTimeout(1500);
await mpage.screenshot({ path: join(OUT, 'showcase/mobile.png'), fullPage: true });

// ---------- reference screenshots (live original) ----------
try {
  await page.goto('https://lishen.by/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'reference/desktop.png'), fullPage: true });
  check('reference.desktop-captured', true);
} catch (e) {
  check('reference.desktop-captured', false, String(e).slice(0, 120));
}
try {
  await mpage.goto('https://lishen.by/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mpage.waitForTimeout(1500);
  await mpage.screenshot({ path: join(OUT, 'reference/mobile.png'), fullPage: true });
  check('reference.mobile-captured', true);
} catch (e) {
  check('reference.mobile-captured', false, String(e).slice(0, 120));
}

// ---------- summarize ----------
// Only first-party request failures count; pre-auth /api/auth/me probes and
// third-party trackers on the live reference site are expected noise.
const localFailures = failedRequests.filter((f) => {
  if (!f.url.startsWith('http://localhost')) return false;
  if (f.url.includes('/api/auth/me') && f.status === 401) return false;
  if (f.url.includes('/api/activity/stream')) return false; // SSE aborted on navigation
  return true;
});
check('network.no-failed-requests', localFailures.length === 0, localFailures.slice(0, 8).map((f) => `${f.status || ''} ${f.url}`).join('; '));
const realConsoleErrors = consoleErrors.filter((c) => !c.text.includes('401') || !c.page.includes('lishen.by'));
check('console.no-errors', realConsoleErrors.length === 0, realConsoleErrors.slice(0, 5).map((c) => c.text.slice(0, 120)).join('; '));

await browser.close();

await mkdir(join(OUT, 'cms'), { recursive: true });
await mkdir(join(OUT, 'showcase'), { recursive: true });
await mkdir(join(OUT, 'reference'), { recursive: true });
await writeFile(join(OUT, 'browser-assertions.json'), JSON.stringify({
  at: new Date().toISOString(),
  siteId: SITE_ID,
  variantToken: VARIANT_TOKEN,
  siteToken: SITE_TOKEN,
  results,
  failedRequests,
  consoleErrors,
}, null, 2));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
process.exit(failed.length ? 1 : 0);
