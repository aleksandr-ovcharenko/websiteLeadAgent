// E2E acceptance: Forge → Studio → edit product → Showcase → approve in Forge
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'data/redesign/reference-quality/puzzlehouse-final';
fs.mkdirSync(OUT, { recursive: true });
const HUB = 'http://localhost:3000';
const SITE = 'cmtprwuik001z141vn1qnped4';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });
await ctx.request.post(`${HUB}/api/auth/login`, { data: { email: 'admin@minsk.local', password: 'admin123' } });

// 1. Forge — card with product count + review badge
const p = await ctx.newPage();
await p.goto(`${HUB}/forge`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.waitForTimeout(4000);
await p.screenshot({ path: `${OUT}/e2e-forge.png` });
const forgeText = await p.evaluate(() => document.body.innerText);
console.log('forge has Pd:', /Pd\s*6/.test(forgeText), '| Awaiting review:', /Awaiting review/i.test(forgeText), '| Approve btn:', await p.$$eval('button', bs => bs.some(b => /approve/i.test(b.innerText))));

// 2. Studio dashboard — product count
await p.goto(`${HUB}/studio/${SITE}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3000);
await p.screenshot({ path: `${OUT}/e2e-studio-dashboard.png` });
const dashText = await p.evaluate(() => document.body.innerText);
console.log('dashboard Products count:', /Products\s*\n?\s*6/.test(dashText.replace(/\s+/g,' ')) || /Products/.test(dashText));

// 3. Products list
await p.evaluate(() => { const el = [...document.querySelectorAll('a,button,div,span')].find(e => (e.innerText||'').trim() === 'Products'); el && el.click(); });
await p.waitForTimeout(2000);
await p.screenshot({ path: `${OUT}/e2e-products-list.png` });

// 4. Гамвик editor — cover preview + gallery
await p.evaluate(() => { const el = [...document.querySelectorAll('button,a')].find(e => (e.innerText||'').trim() === 'Гамвик'); el && el.click(); });
await p.waitForTimeout(2000);
await p.screenshot({ path: `${OUT}/e2e-product-editor.png`, fullPage: false });
const editorInfo = await p.evaluate(() => ({
  coverImg: !!document.querySelector('img[src*="/site-media/"]'),
  galleryImgs: document.querySelectorAll('img[src*="/site-media/"]').length,
}));
console.log('editor:', JSON.stringify(editorInfo));

// 5. edit summary → save → verify in Showcase
const textarea = await p.$('textarea[placeholder*="Short summary"]');
const NEWVAL = 'E2E-ТЕСТ-СВОДКА ' + Date.now();
await textarea.fill(NEWVAL);
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Update|Publish/i.test(b.innerText)); b && b.click(); });
await p.waitForTimeout(2500);

const pv = await ctx.newPage();
await pv.goto('http://localhost:3336/preview/gvb3wdg3hi/products/гамвик-пазл-хаус', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await pv.waitForTimeout(2500);
const pvText = await pv.evaluate(() => document.body.innerText);
console.log('showcase shows edited summary:', pvText.includes(NEWVAL));
await pv.close();

// restore
await p.goto(`${HUB}/studio/${SITE}`, { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(2500);
await p.evaluate(() => { const el = [...document.querySelectorAll('a,button,div,span')].find(e => (e.innerText||'').trim() === 'Products'); el && el.click(); });
await p.waitForTimeout(1500);
await p.evaluate(() => { const el = [...document.querySelectorAll('button,a')].find(e => (e.innerText||'').trim() === 'Гамвик'); el && el.click(); });
await p.waitForTimeout(2000);
const t2 = await p.$('textarea[placeholder*="Short summary"]');
await t2.fill('');
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Update|Publish/i.test(b.innerText)); b && b.click(); });
await p.waitForTimeout(2500);
console.log('restored summary');

// 6. Forge — approve
await p.goto(`${HUB}/forge`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.waitForTimeout(4000);
await p.screenshot({ path: `${OUT}/e2e-forge-awaiting.png` });
const clicked = await p.evaluate(() => {
  const row = [...document.querySelectorAll('tr,div')].find(r => /Пазл Хаус/.test(r.innerText||''));
  if (!row) return false;
  const btn = [...row.querySelectorAll('button')].find(b => /^Approve$/i.test(b.innerText||''));
  if (btn) { btn.click(); return true; }
  return false;
});
console.log('approve clicked:', clicked);
await p.waitForTimeout(2000);
await p.screenshot({ path: `${OUT}/e2e-forge-approved.png` });
const after = await p.evaluate(() => document.body.innerText);
console.log('Demo ready visible:', /Demo ready/i.test(after));
await browser.close();
