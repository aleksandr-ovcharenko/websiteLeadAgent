import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'data/redesign/reference-quality/puzzlehouse-final';
fs.mkdirSync(OUT, { recursive: true });
const TOKEN = 'gvb3wdg3hi';
const R = 'http://localhost:3336';
const HUB = 'http://localhost:3000';
const SITE = 'cmtprwuik001z141vn1qnped4';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
await ctx.request.post(`${HUB}/api/auth/login`, { data: { email: 'admin@minsk.local', password: 'admin123' } });

// showcase shots
for (const [name, url, vw, full] of [
  ['desktop-home-full', `/preview/${TOKEN}`, { width: 1440, height: 900 }, true],
  ['mobile-home-full', `/preview/${TOKEN}`, { width: 390, height: 844 }, true],
  ['desktop-product-detail', `/preview/${TOKEN}/products/гамвик-пазл-хаус`, { width: 1440, height: 900 }, true],
  ['mobile-product-detail', `/preview/${TOKEN}/products/гамвик-пазл-хаус`, { width: 390, height: 844 }, true],
]) {
  const page = await ctx.newPage();
  await page.setViewportSize(vw);
  await page.goto(R + url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await page.close();
  console.log('shot', name);
}

// hub preview — Forge/Hub card must show the CURRENT hero
const hub = await ctx.newPage();
await hub.setViewportSize({ width: 1600, height: 1000 });
await hub.goto(`${HUB}/forge`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await hub.waitForTimeout(3500);
await hub.screenshot({ path: `${OUT}/hub-preview.png` });
// verify the thumbnail URL carries the version param
const imgSrc = await hub.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.src).filter((s) => s.includes('site-screenshots'))[0] || 'NONE');
console.log('hub thumb:', imgSrc);
await hub.close();

// Studio: products list
const st = await ctx.newPage();
await st.setViewportSize({ width: 1600, height: 1000 });
await st.goto(`${HUB}/studio/${SITE}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await st.waitForTimeout(2500);
await st.click('text=Products').catch(async () => { await st.click('text=Товары').catch(() => {}); });
await st.waitForTimeout(1500);
await st.screenshot({ path: `${OUT}/cms-products-list.png` });
// open Гамвик editor
await st.click('text=Гамвик').catch(() => {});
await st.waitForTimeout(1500);
await st.screenshot({ path: `${OUT}/cms-product-editor.png` });
await st.close();

await browser.close();
console.log('done');
