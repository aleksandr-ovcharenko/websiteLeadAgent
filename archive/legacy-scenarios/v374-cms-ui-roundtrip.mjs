// V3.7.4 Phase 4 — STRICT EDITABILITY roundtrip through the CMS Studio UI
// (Playwright, real controls — not API calls).
//
// For the recovered NextTrade site (1dooxfp9 / cmuctw9vr0004iejw4nd89vbt):
//   1. open the Service Editor for `dizain-proekt-magazina-1` in the UI;
//   2. assert [data-cms-control] exists for title, shortDescription and every
//      structured block field incl. items[];
//   3. edit items[0] + shortDescription through the UI, Save, verify the
//      rendered showcase shows the marker;
//   4. reload the editor, verify persistence, and assert every UNTOUCHED
//      block is deep-equal (no destructive flattening);
//   5. restore via the UI, verify marker gone;
//   6. capture before/after screenshots of the CMS editor and the page.
//
// Usage: node scripts/v374-cms-ui-roundtrip.mjs
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import assert from 'node:assert/strict';

const GATEWAY = 'http://localhost:3000';
// Studio must be reached through the GATEWAY: it routes /api/cms → :3335.
// The vite dev port (:3004) proxies all /api → :3333 where /api/cms is 404.
const STUDIO = GATEWAY;
const SITE = 'cmuctw9vr0004iejw4nd89vbt';
const TOKEN = '1dooxfp9';
const SVC_SLUG = 'planirovka-torgovogo-zala-1';
const M = 'V374EDIT';
const OUT = 'data/redesign/v374/nexttrade-recovery';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(ok ? '  PASS' : '  FAIL', name, '|', String(detail).slice(0, 140)); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.request.post(`${GATEWAY}/api/auth/login`, { data: { email: 'admin@minsk.local', password: 'admin123' }, headers: { Origin: GATEWAY } });

const api = (m, path, body) => page.request.fetch(`${GATEWAY}${path}`, { method: m, data: body, headers: { 'Content-Type': 'application/json', Origin: GATEWAY } });
const bundle = () => api('GET', `/api/cms/sites/${SITE}`).then((r) => r.json());
// Canonical deep-equal: sort object keys recursively — key ordering from
// server-side zod re-serialization is not data mutation.
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v;
};
const deepEqual = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

const before = await bundle();
const svc = before.services.find((s) => s.slug === SVC_SLUG);
assert.ok(svc, `service ${SVC_SLUG} not found`);
const stripMarker = (v) => typeof v === 'string' ? v.replace(/^V374EDIT\s*/g, '') : v;
const origBlocks = JSON.parse(JSON.stringify(svc.blocks || []));
const origDesc = stripMarker(svc.shortDescription || '');

// ── 1-2. Open the Service Editor in the UI; verify controls exist ───────────
await page.goto(`${STUDIO}/studio/${SITE}?screen=service-editor&edit=${svc.id}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-cms-control="service:title"]', { timeout: 15000 });
// Wait for the CMS bundle to hydrate — title input populated with the real title.
await page.waitForFunction(
  (expected) => {
    const t = document.querySelector('[data-cms-control="service:title"] input');
    return t && t.value === expected;
  }, svc.title, { timeout: 15000 },
).catch(() => null);
check('editor opened via deep link', true, page.url());
// Field controls render inside the expanded block — open the items block.
const itemsBlockIdx = (svc.blocks || []).findIndex((b) => Array.isArray(b.items) && b.items.length);
const expandIdx = itemsBlockIdx >= 0 ? itemsBlockIdx : 0;
await page.waitForSelector('[data-cms-block]', { timeout: 10000 }).catch(() => null);
const rows = await page.$$('[data-cms-block]');
check('block rows render', rows.length === (svc.blocks || []).length, `${rows.length}/${(svc.blocks || []).length}`);
if (rows[expandIdx]) { await rows[expandIdx].click(); await page.waitForTimeout(400); }
const controls = await page.$$eval('[data-cms-control]', (els) => els.map((e) => e.getAttribute('data-cms-control')));
check('title control exists', controls.includes('service:title'), 'service:title');
check('shortDescription control exists', controls.includes('service:shortDescription'), 'service:shortDescription');
const blockControls = controls.filter((c) => c.startsWith('block:'));
check('block controls exist', blockControls.length > 0, `${blockControls.length} controls`);
const itemsControl = blockControls.find((c) => /items\[\d+\]$/.test(c) || c.endsWith(':items'));
check('items[] control exists (the V3.7.3 defect)', !!itemsControl, itemsControl || 'none');
const enabledToggle = await page.$$('button[aria-label*="Hide block"], button[aria-label*="Show block"]');
check('enabled toggles exist', enabledToggle.length >= (svc.blocks || []).length, `${enabledToggle.length} toggles`);
await page.screenshot({ path: `${OUT}/cms-editor-before.png` });

// ── 3. Edit through UI controls; save; verify render ────────────────────────
const itemBlockIdx = itemsBlockIdx;
const itemBlockId = itemBlockIdx >= 0 ? svc.blocks[itemBlockIdx].id : null;
let editedItem = null;
if (itemBlockId) {
  const sel = `[data-cms-control="block:${itemBlockId}:field:items[0]"] textarea, [data-cms-control="block:${itemBlockId}:field:items[0]"] input`;
  const itemLoc = page.locator(sel).first();
  const hasCtl = (await itemLoc.count()) > 0;
  check('items[0] control found in DOM', hasCtl, sel);
  if (hasCtl) {
    editedItem = svc.blocks[itemBlockIdx].items[0];
    const origVal = stripMarker(typeof editedItem === 'string' ? editedItem : (editedItem.title || ''));
    if (typeof editedItem === 'string') editedItem = origVal;
    await itemLoc.fill(`${M} ${origVal}`.slice(0, 200));
    await page.waitForTimeout(150);
  }
}
const descLoc = page.locator('[data-cms-control="service:shortDescription"] textarea').first();
check('shortDescription control found in DOM', (await descLoc.count()) > 0);
if (await descLoc.count()) {
  await descLoc.fill(`${M} ${origDesc}`.slice(0, 240));
  await page.waitForTimeout(150);
}

// Save via the UI button (Update for published entities)
const saveBtn = await page.$('button:has-text("Update"), button:has-text("Publish")');
check('save button found', !!saveBtn);
if (saveBtn) {
  const [putRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/services/${svc.id}`) && r.request().method() === 'PUT', { timeout: 10000 }).catch(() => null),
    saveBtn.click(),
  ]);
  check('save PUT succeeded', putRes?.status() === 200, `status ${putRes?.status()}`);
  await page.waitForTimeout(800);
}

// Render check — marker must appear on the service detail page
await page.goto(`${GATEWAY}/showcase/${TOKEN}/${svc.previewPath?.replace(/^\//, '') || SVC_SLUG}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
const rendered = await page.locator('body').innerText();
check('edited summary renders on detail page', rendered.includes(M), 'marker visible');
await page.screenshot({ path: `${OUT}/page-after-edit.png` });

// ── 4. Persistence + lossless untouched blocks ──────────────────────────────
const mid = await bundle();
const svcMid = mid.services.find((s) => s.id === svc.id);
check('summary persisted', (svcMid.shortDescription || '').startsWith(M), svcMid.shortDescription?.slice(0, 60));
let lossless = true;
let lossDetail = '';
for (let i = 0; i < origBlocks.length; i++) {
  const a = origBlocks[i], b = svcMid.blocks[i];
  if (i === itemBlockIdx) {
    const aItems = a.items.slice(1), bItems = (b.items || []).slice(1);
    const aCopy = { ...a, items: aItems }, bCopy = { ...b, items: bItems };
    if (!deepEqual(aCopy, bCopy)) { lossless = false; lossDetail = `block ${i} changed beyond items[0]`; }
  } else if (!deepEqual(a, b)) { lossless = false; lossDetail = `untouched block ${i} (${a.type}) mutated`; }
}
check('untouched blocks deep-equal (no flattening)', lossless, lossDetail || `${origBlocks.length} blocks`);
check('block ids preserved', deepEqual(origBlocks.map((b) => b.id), svcMid.blocks.map((b) => b.id)), 'ids stable');
check('block types preserved', deepEqual(origBlocks.map((b) => b.type), svcMid.blocks.map((b) => b.type)), 'types stable');

// Reload the editor — verify persistence through the UI
await page.goto(`${STUDIO}/studio/${SITE}?screen=service-editor&edit=${svc.id}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-cms-control="service:title"]', { timeout: 15000 });
await page.waitForFunction(
  () => {
    const t = document.querySelector('[data-cms-control="service:shortDescription"] textarea');
    return t && t.value.length > 0;
  }, { timeout: 15000 },
).catch(() => null);
const descAfter = await page.$eval('[data-cms-control="service:shortDescription"] textarea', (el) => el.value);
check('reloaded editor shows persisted edit', descAfter.startsWith(M), descAfter.slice(0, 60));

// ── 5. Restore through the UI ───────────────────────────────────────────────
const descLoc2 = page.locator('[data-cms-control="service:shortDescription"] textarea').first();
check('restore textarea found', (await descLoc2.count()) > 0, '');
if (await descLoc2.count()) {
  await descLoc2.fill(origDesc);
  await page.waitForTimeout(150);
  check('restore fill took effect', (await descLoc2.evaluate((el) => el.value)) === origDesc,
    (await descLoc2.evaluate((el) => el.value)).slice(0, 50));
}
if (itemBlockId && editedItem !== null) {
  // Blocks render collapsed after reload — re-expand the items block first.
  const rows2 = await page.$$('[data-cms-block]');
  if (rows2[expandIdx]) { await rows2[expandIdx].click(); await page.waitForTimeout(400); }
  const sel = `[data-cms-control="block:${itemBlockId}:field:items[0]"] textarea, [data-cms-control="block:${itemBlockId}:field:items[0]"] input`;
  const itemLoc2 = page.locator(sel).first();
  if (await itemLoc2.count()) {
    await itemLoc2.fill(typeof editedItem === 'string' ? editedItem : (editedItem.title || ''));
    await page.waitForTimeout(150);
  }
}
const saveBtn2 = await page.$('button:has-text("Update"), button:has-text("Publish")');
check('restore textarea DOM clean', (await page.$eval('[data-cms-control="service:shortDescription"] textarea', (el) => el.value)) === origDesc, 'dom value');
if (saveBtn2) {
  const [putRes2] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/services/${svc.id}`) && r.request().method() === 'PUT', { timeout: 10000 }).catch(() => null),
    saveBtn2.click(),
  ]);
  check('restore PUT succeeded', putRes2?.status() === 200, `status ${putRes2?.status()}`);
  try { const pd = JSON.parse(putRes2?.request()?.postData() || '{}'); check('restore payload has clean summary', pd.shortDescription === origDesc, String(pd.shortDescription).slice(0, 60)); } catch {}
  await page.waitForTimeout(800);
}
const restored = await bundle();
const svcEnd = restored.services.find((s) => s.id === svc.id);
check('restored summary', svcEnd.shortDescription === origDesc, svcEnd.shortDescription?.slice(0, 60));
check('blocks deep-equal after restore', deepEqual(origBlocks, svcEnd.blocks), `${svcEnd.blocks.length} blocks`);
await page.goto(`${GATEWAY}/showcase/${TOKEN}/${SVC_SLUG}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
check('marker gone after restore', !(await page.locator('body').innerText()).includes(M));
await page.screenshot({ path: `${OUT}/cms-editor-after.png` });

await browser.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} CMS UI roundtrip checks passed`);
await mkdir(dirname(`${OUT}/cms-ui-roundtrip.json`), { recursive: true });
await writeFile(`${OUT}/cms-ui-roundtrip.json`, JSON.stringify({ generatedAt: new Date().toISOString(), site: SITE, service: svc.id, controls, results }, null, 2));
process.exit(pass === results.length ? 0 : 1);
