// V3.7.5 Part E/F — Forge preview evidence: every site card renders a real
// screenshot (img.complete && naturalWidth > 0) and the versioned URL answers
// 200 + image/png. Captures page screenshots to e2e/artifacts/.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.PLATFORM_URL || 'http://localhost:3004';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@minsk.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

async function main() {
  await mkdir('apps/platform/e2e/artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const imgResponses = [];
  page.on('response', (res) => {
    if (res.url().includes('/site-screenshots/')) {
      imgResponses.push({ url: res.url(), status: res.status(), ct: res.headers()['content-type'] });
    }
  });

  try {
    await page.goto(`${BASE}/forge`);
    await page.evaluate(({ email, password }) => fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }), credentials: 'include',
    }), { email: TEST_EMAIL, password: TEST_PASSWORD });
    await page.goto(`${BASE}/forge`);
    await page.waitForSelector('img[src*="site-screenshots"]', { timeout: 20000 });
    await sleep(3000); // let all card images settle

    const imgs = await page.$$eval('img[src*="site-screenshots"]', (els) =>
      els.map((img) => ({ src: img.src, w: img.naturalWidth, h: img.naturalHeight, complete: img.complete })));
    console.log(`forge cards with preview img: ${imgs.length}`);
    for (const i of imgs) {
      console.log(`  ${i.src.slice(-70)} | ${i.w}x${i.h} complete=${i.complete}`);
      if (!i.complete || i.w <= 0 || i.h <= 0) throw new Error(`broken preview image: ${i.src}`);
    }
    if (imgs.length === 0) throw new Error('no site-screenshots images rendered on Forge');

    for (const r of imgResponses) {
      console.log(`  net ${r.status} ${r.ct} ${r.url.slice(-70)}`);
      if (r.status !== 200 || !r.ct?.includes('image/png')) {
        throw new Error(`bad preview response: ${r.status} ${r.ct} ${r.url}`);
      }
    }

    await page.screenshot({ path: 'apps/platform/e2e/artifacts/v375-forge-previews.png', fullPage: false });
    await page.screenshot({ path: 'apps/platform/e2e/artifacts/v375-forge-previews-full.png', fullPage: true });

    // Detail evidence: capture the first card's region (hover overlay makes
    // the img itself unclickable — the card frame carries the click).
    const card = page.locator('img[src*="site-screenshots"]').first().locator('xpath=ancestor::div[contains(@class,"group")][1]');
    await card.screenshot({ path: 'apps/platform/e2e/artifacts/v375-forge-detail.png' }).catch(() => {});

    console.log('PASS: forge preview contract (all card images real PNGs, 200/image/png, natural dims > 0)');
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
