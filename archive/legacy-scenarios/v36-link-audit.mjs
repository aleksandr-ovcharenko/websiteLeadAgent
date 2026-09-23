// V3.6 link audit — every actionable control on the rendered showcase must
// resolve: no '#', no empty href, no original-domain leaks, internal targets 200.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const GATEWAY = 'http://localhost:3000';
const TOKEN = process.argv[2] || 'muazd8vjzv4j';
const ORIGIN_DOMAIN = 'lishen.by';

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${GATEWAY}/showcase/${TOKEN}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const links = await page.$$eval('a[href], [role="link"]', (els) =>
  els.map((el) => ({
    tag: el.tagName.toLowerCase(),
    href: el.getAttribute('href'),
    text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 60),
  }))
);

// Functional check for non-link controls: each must produce a visible effect.
const buttonChecks = [];
// 1) nav dropdown toggle (▾ submenu disclosure) — aria-expanded flips
const dd = page.locator('.header__sub-toggle').first();
if (await dd.count()) {
  const before = await dd.getAttribute('aria-expanded');
  await dd.click().catch(() => {});
  await page.waitForTimeout(400);
  const after = await dd.getAttribute('aria-expanded');
  const subVisible = await page.locator('.header__sub:visible').count();
  buttonChecks.push({ control: 'nav-dropdown-toggle', status: before !== after && subVisible > 0 ? 'OK' : 'FAIL', reason: `aria-expanded ${before}→${after}, submenu visible: ${subVisible > 0}` });
  await dd.click().catch(() => {});
}
// 2) service index buttons — activate the preview panel
const svcBtn = page.locator('.service-item__btn').nth(1);
if (await svcBtn.count()) {
  await svcBtn.click().catch(() => {});
  await page.waitForTimeout(400);
  const cls = await svcBtn.locator('..').getAttribute('class');
  buttonChecks.push({ control: 'service-item-button', status: /--active/.test(cls || '') ? 'OK' : 'FAIL', reason: `item class: ${cls}` });
}
// 3) project action — opens the Detail overlay
const openBtn = page.locator('.case__action').first();
if (await openBtn.count()) {
  await openBtn.click().catch(() => {});
  await page.waitForTimeout(600);
  const overlay = await page.locator('.detail, [role="dialog"], .case-detail').count();
  buttonChecks.push({ control: 'project-open-action', status: overlay > 0 ? 'OK' : 'FAIL', reason: `detail overlay present: ${overlay > 0}` });
  await page.keyboard.press('Escape').catch(() => {});
}

const findings = [];
const seen = new Set();
for (const l of links) {
  const key = `${l.href}|${l.text}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!l.href) { findings.push({ ...l, status: 'FAIL', reason: 'no href on actionable element' }); continue; }
  if (l.href === '#' || l.href === '') { findings.push({ ...l, status: 'FAIL', reason: 'empty/# href' }); continue; }
  if (/^javascript:/i.test(l.href)) { findings.push({ ...l, status: 'FAIL', reason: 'javascript: href' }); continue; }
  if (l.href.includes(ORIGIN_DOMAIN)) { findings.push({ ...l, status: 'FAIL', reason: 'original-domain link leaks into generated UI' }); continue; }
  if (l.href.startsWith('#')) {
    const exists = await page.locator(l.href).count().catch(() => 0);
    findings.push({ ...l, status: exists ? 'OK' : 'FAIL', reason: exists ? 'anchor resolves' : 'anchor missing in DOM' });
    continue;
  }
  if (/^(tel:|mailto:)/i.test(l.href)) { findings.push({ ...l, status: 'OK', reason: 'contact scheme link' }); continue; }
  // Non-scoped internal paths escape the preview context — flag them.
  if (/^\//.test(l.href) && !l.href.startsWith(`/showcase/`) && !/^\/(site-media|api)\//.test(l.href)) {
    findings.push({ ...l, status: 'FAIL', reason: 'internal link not variant-scoped (escapes showcase)' }); continue;
  }
  const url = l.href.startsWith('http') ? l.href : `${GATEWAY}${l.href.startsWith('/') ? '' : '/'}${l.href}`;
  const isInternal = url.startsWith(GATEWAY);
  const res = isInternal ? await page.request.get(url).catch(() => null) : null;
  findings.push({ ...l, resolved: url, status: isInternal ? (res && res.ok() ? 'OK' : 'FAIL') : 'EXTERNAL', reason: isInternal ? `HTTP ${res ? res.status() : 'error'}` : 'external link (not audited)' });
}

await browser.close();
const all = [...findings, ...buttonChecks];
const fails = all.filter((f) => f.status === 'FAIL');
await writeFile('data/redesign/v36/link-audit.json', JSON.stringify({ at: new Date().toISOString(), token: TOKEN, total: all.length, failed: fails.length, findings: all }, null, 2));
console.log(`links+controls: ${all.length}, failed: ${fails.length}`);
for (const f of fails) console.log(' FAIL', JSON.stringify(f));
for (const b of buttonChecks) console.log(' BTN', JSON.stringify(b));
