// Acceptance package capture for lishen + sdke
import { chromium } from 'playwright';
import fs from 'node:fs';

const SITES = {
  lishen: { siteId: 'cmtprwtqr0004141vvep7t2so', token: '8wxjxvf2ju' },
  sdke:   { siteId: 'cmtprx0el0034141vmoczn0zm', token: 'gxdjko5gcq' },
};
const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
await ctx.request.post('http://localhost:3000/api/auth/login', { data: { email: 'admin@minsk.local', password: 'admin123' } });

for (const [name, { siteId, token }] of Object.entries(SITES)) {
  const out = `data/redesign/reference-quality/${name}`;
  fs.mkdirSync(out, { recursive: true });
  for (const [w, tag] of [[1440, 'desktop'], [390, 'mobile']]) {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: w, height: 844 });
    await p.goto(`http://localhost:3336/preview/${token}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/${tag}-home-full.png`, fullPage: true });
    const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, broken: [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).length }));
    console.log(`${name} ${tag}: overflow=${r.sw > r.cw} broken=${r.broken}`);
    // project detail
    await p.goto(`http://localhost:3336/preview/${token}/projects`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2000);
    const first = await p.$$eval('a[href*="/projects/"]', as => as[0]?.href);
    if (first) {
      await p.goto(first, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(2000);
      await p.screenshot({ path: `${out}/${tag}-project-detail.png`, fullPage: true });
    }
    await p.close();
  }
  // CMS screens
  const s = await ctx.newPage();
  await s.setViewportSize({ width: 1600, height: 1000 });
  await s.goto(`http://localhost:3000/studio/${siteId}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await s.waitForTimeout(3000);
  await s.evaluate(() => { const el = [...document.querySelectorAll('a,button,div,span')].find(e => (e.innerText || '').trim() === 'Services'); el && el.click(); });
  await s.waitForTimeout(1500);
  await s.screenshot({ path: `${out}/cms-services.png` });
  await s.evaluate(() => { const el = [...document.querySelectorAll('a,button,div,span')].find(e => (e.innerText || '').trim() === 'Projects'); el && el.click(); });
  await s.waitForTimeout(1500);
  await s.screenshot({ path: `${out}/cms-projects.png` });
  const firstProj = await s.$$eval('button,a', bs => { const b = bs.find(b => /объект|бассейн|дизайн-проект|квартир/i.test(b.innerText || '') && b.tagName === 'BUTTON'); if (b) { b.click(); return b.innerText.slice(0, 40); } return null; });
  await s.waitForTimeout(2000);
  await s.screenshot({ path: `${out}/cms-project-editor.png` });
  console.log(`${name}: project editor opened = ${firstProj}`);
  await s.close();
}
// Forge awaiting screenshots
const f = await ctx.newPage();
await f.setViewportSize({ width: 1600, height: 1000 });
await f.goto('http://localhost:3000/forge', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await f.waitForTimeout(4000);
await f.screenshot({ path: 'data/redesign/reference-quality/lishen/forge-awaiting.png' });
await f.screenshot({ path: 'data/redesign/reference-quality/sdke/forge-awaiting.png' });
await browser.close();
console.log('done');
