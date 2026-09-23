import { chromium } from 'playwright';
import { join } from 'node:path';

const out = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c25-creative-breakout/selected/screenshots';
const browser = await chromium.launch({ headless: true });

async function captureAt(url, name, selector) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(s => { const e=document.querySelector(s); if(e) e.scrollIntoView({behavior:'auto',block:'start'}); }, selector);
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, `${name}-desktop.png`), fullPage: false });
    console.log('captured', name);
  } catch (e) { console.error('fail', name, e.message); }
  await ctx.close();
}

await captureAt('http://localhost:4002/selected/render/c25-selected.html', 'c25-selected-portfolio', '#portfolio');
await captureAt('http://localhost:4002/selected/render/c25-selected.html', 'c25-selected-testimonials', '#testimonials');
await browser.close();
