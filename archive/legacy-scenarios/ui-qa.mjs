// ActionMenu geometry + certificates rendering + viewport QA.
// Usage: node scripts/ui-qa.mjs
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const GATEWAY = 'http://localhost:3000';
const SHOWCASE = `${GATEWAY}/showcase/3fx5dct2`;
const SITE = 'cmuazd8v900011kiu4bp2hsnf';
const OUT_DIR = 'data/redesign/v361';

const results = [];
const check = (area, name, ok, detail) => {
  results.push({ area, name, ok, detail });
  console.log(ok ? '  PASS' : '  FAIL', `[${area}]`, name, detail ? `| ${detail}` : '');
};

// Assert a portal menu is fully inside the viewport and escapes clipping ancestors.
async function assertMenuGeometry(page, area, label) {
  const m = await page.locator('[role="menu"]').first();
  if (!(await m.count())) { check(area, `${label}:menu-open`, false, 'no menu in DOM'); return; }
  const geo = await m.evaluate((el) => {
    const r = el.getBoundingClientRect();
    // Ancestor-clipping proof: menu must be a direct child of <body> (portal).
    const portal = el.parentElement === document.body;
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right, vw: innerWidth, vh: innerHeight, portal };
  });
  const inside = geo.top >= -1 && geo.left >= -1 && geo.bottom <= geo.vh + 1 && geo.right <= geo.vw + 1;
  check(area, `${label}:in-viewport`, inside && geo.portal, JSON.stringify({ ...geo, vw: undefined, vh: undefined }).slice(0, 110) + ` vw=${geo.vw} vh=${geo.vh}`);
}

async function openRowMenu(page, rowIdx) {
  const rows = page.locator('tbody tr');
  const n = await rows.count();
  const i = rowIdx === 'last' ? n - 1 : rowIdx;
  const row = rows.nth(i);
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  const btn = row.locator('button[aria-haspopup="menu"]').first();
  await btn.click();
  await page.waitForTimeout(250);
  return { row: i, n };
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.request.post(`${GATEWAY}/api/auth/login`, { data: { email: 'admin@minsk.local', password: 'admin123' }, headers: { Origin: GATEWAY } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// ─── CMS Pages action menu: first/middle/last row @1440 ─────────────────────
await page.goto(`${GATEWAY}/studio/${SITE}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
// Navigate to Pages screen.
await page.locator('a,button').filter({ hasText: /Страницы|Pages/ }).first().click().catch(() => {});
await page.waitForTimeout(1200);
const rows = await page.locator('tbody tr').count();
check('cms-pages', 'table-rows', rows >= 5, `${rows} rows`);
for (const [label, idx] of [['first', 0], ['middle', Math.floor(rows / 2)], ['last', 'last']]) {
  await openRowMenu(page, idx);
  await assertMenuGeometry(page, 'cms-pages', label);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('cms-pages', `${label}:escape-closes`, (await page.locator('[role="menu"]').count()) === 0, '');
}

// Keyboard-only: focus trigger, Enter, ArrowDown through items, Escape → focus back.
{
  await openRowMenu(page, 0);
  const active = await page.evaluate(() => document.activeElement?.getAttribute('role'));
  check('cms-pages', 'kbd:focus-first-item', active === 'menuitem', `active=${active}`);
  await page.keyboard.press('ArrowDown');
  const labels = await page.locator('[role="menu"] [role="menuitem"]').allInnerTexts();
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  check('cms-pages', 'kbd:arrow-moves', focused === labels[1]?.trim(), `focused="${focused}"`);
  await page.keyboard.press('End');
  const lastFocused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  check('cms-pages', 'kbd:end-key', lastFocused === labels[labels.length - 1]?.trim(), `focused="${lastFocused}"`);
  await page.keyboard.press('Escape');
  const backOnTrigger = await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup') === 'menu');
  check('cms-pages', 'kbd:focus-returns-to-trigger', backOnTrigger, '');
}

// Near-bottom + near-right edge: scroll last row into view at viewport bottom.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);
await openRowMenu(page, 'last');
await assertMenuGeometry(page, 'cms-pages', 'bottom-edge');
await page.keyboard.press('Escape');

// ─── CMS Pages @1024 and @768 ────────────────────────────────────────────────
for (const w of [1024, 768]) {
  await page.setViewportSize({ width: w, height: 800 });
  await page.waitForTimeout(300);
  await openRowMenu(page, 'last');
  await assertMenuGeometry(page, `cms-pages-${w}px`, 'last-row');
  await page.keyboard.press('Escape');
}
await page.setViewportSize({ width: 1440, height: 900 });

// ─── Forge: table + visual-card menus ────────────────────────────────────────
await page.goto(`${GATEWAY}/forge`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const forgeRows = await page.locator('tbody tr').count();
check('forge-table', 'rows', forgeRows > 0, `${forgeRows}`);
await openRowMenu(page, 0);
await assertMenuGeometry(page, 'forge-table', 'first-row');
await page.keyboard.press('Escape');
await openRowMenu(page, 'last');
await assertMenuGeometry(page, 'forge-table', 'last-row');
await page.keyboard.press('Escape');

// Visual card view.
await page.locator('button').filter({ hasText: 'Visual' }).first().click();
await page.waitForTimeout(800);
{
  const card = page.locator('.grid > div').last();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await card.locator('button[aria-haspopup="menu"]').first().click();
  await page.waitForTimeout(250);
  await assertMenuGeometry(page, 'forge-visual', 'card-menu');
  await page.keyboard.press('Escape');
}
// Forge @768 right-edge.
await page.setViewportSize({ width: 768, height: 800 });
await page.locator('button').filter({ hasText: 'Table' }).first().click().catch(() => {});
await page.waitForTimeout(500);
{
  const row = page.locator('tbody tr').first();
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await row.locator('button[aria-haspopup="menu"]').first().click();
  await page.waitForTimeout(250);
  await assertMenuGeometry(page, 'forge-table-768px', 'right-edge');
  await page.keyboard.press('Escape');
}
await page.setViewportSize({ width: 1440, height: 900 });

// ─── Certificates: grid, image integrity, lightbox ──────────────────────────
await page.goto(`${SHOWCASE}/licenses`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const certImgs = page.locator('.certs__grid img');
const nCerts = await certImgs.count();
check('certs', 'grid-count', nCerts === 6, `${nCerts} docs`);
for (let i = 0; i < nCerts; i++) {
  const st = await certImgs.nth(i).evaluate((el) => ({
    loaded: el.complete && el.naturalWidth > 0,
    fit: getComputedStyle(el).objectFit,
    // Stretch check: rendered aspect ratio vs natural aspect ratio.
    distorted: Math.abs((el.clientWidth / el.clientHeight) - (el.naturalWidth / el.naturalHeight)) > 0.15,
  }));
  check('certs', `doc-${i}:loaded`, st.loaded, '');
  check('certs', `doc-${i}:contain`, st.fit === 'contain' && !st.distorted, `fit=${st.fit} distorted=${st.distorted}`);
}

// Lightbox: open → next → Escape → focus return.
await certImgs.first().click();
await page.waitForTimeout(400);
check('certs', 'lightbox-opens', (await page.locator('[role="dialog"].lightbox').count()) === 1, '');
const count0 = await page.locator('.lightbox__count').innerText().catch(() => '');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
const count1 = await page.locator('.lightbox__count').innerText().catch(() => '');
check('certs', 'lightbox-next', count0.trim().startsWith('1') && count1.trim().startsWith('2'), `${count0}→${count1}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('certs', 'lightbox-escape', (await page.locator('.lightbox').count()) === 0, '');

// ─── Viewport sweep on showcase ──────────────────────────────────────────────
for (const w of [1440, 1024, 768, 390]) {
  await page.setViewportSize({ width: w, height: 850 });
  for (const p of ['', 'licenses']) {
    await page.goto(`${SHOWCASE}/${p}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`viewport-${w}`, `${p || 'home'}:no-x-overflow`, overflow <= 1, `${overflow}px`);
    const mismatch = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('[aria-controls]').forEach((t) => {
        const c = document.getElementById(t.getAttribute('aria-controls'));
        if (!c) return;
        const cs = getComputedStyle(c);
        const visible = !c.hidden && !c.hasAttribute('inert') && c.getAttribute('aria-hidden') !== 'true' && cs.display !== 'none' && cs.opacity !== '0';
        if (t.getAttribute('aria-expanded') === 'true' && !visible) bad.push(c.id);
        if (t.getAttribute('aria-expanded') === 'false' && visible) bad.push(c.id);
      });
      return bad;
    });
    check(`viewport-${w}`, `${p || 'home'}:aria-sync`, mismatch.length === 0, mismatch.join(';') || 'ok');
  }
}

// Mobile nav: disclosure accordion works at 390px.
await page.setViewportSize({ width: 390, height: 850 });
await page.goto(SHOWCASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.locator('.header__menu-toggle').click();
await page.waitForTimeout(300);
const mobDisc = page.locator('button.header__disclosure').first();
const mobH = await mobDisc.evaluate((el) => el.getBoundingClientRect().height);
check('mobile-nav', 'toggle-44px', mobH >= 44, `h=${mobH}`);
await mobDisc.click();
await page.waitForTimeout(200);
check('mobile-nav', 'accordion-opens', (await page.locator('.header__sub:not([hidden])').count()) === 1, '');

// Reduced motion.
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const rpage = await rm.newPage();
await rpage.goto(SHOWCASE, { waitUntil: 'domcontentloaded' });
await rpage.waitForTimeout(1500);
const rmErr = [];
rpage.on('pageerror', (e) => rmErr.push(e.message));
await rpage.locator('button.header__disclosure').first().click();
check('reduced-motion', 'submenu-works', (await rpage.locator('.header__sub:not([hidden])').count()) === 1, '');
await rm.close();

check('global', 'no-pageerrors', errors.length === 0, errors.join(' | ') || 'clean');
await browser.close();

await mkdir(OUT_DIR, { recursive: true });
const geom = results.filter((r) => r.name.includes('in-viewport'));
await writeFile(`${OUT_DIR}/action-menu-geometry.json`, JSON.stringify({ generatedAt: new Date().toISOString(), checks: geom, allPassed: geom.every((g) => g.ok) }, null, 2));
const certRes = results.filter((r) => r.area === 'certs');
await writeFile(`${OUT_DIR}/certificate-rendering.json`, JSON.stringify({ generatedAt: new Date().toISOString(), checks: certRes, allPassed: certRes.every((g) => g.ok) }, null, 2));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
