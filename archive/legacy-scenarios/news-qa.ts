import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'screenshots', 'news-qa');

const SITE_ID = 'cmtdkqiu50004crwd529otns8';
const PREVIEW_TOKEN = '8e25ix7c';
const ORIGINAL_TITLE = 'Компания приняла участие в строительной выставке BuildExpo 2025';
const TEST_TITLE = 'BuildExpo 2025 — QA TEST';

async function login(page: any) {
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'admin@minsk.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('h1:has-text("WebsiteLeadAgent")', { timeout: 10000 });
}

async function shot(page: any, name: string) {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs: string[] = [];
  page.on('console', (msg: any) => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', (err: any) => { logs.push(`PAGEERROR: ${err.message}`); });
  page.on('response', (r: any) => { if (r.status() >= 400) logs.push(`HTTP ${r.status()} ${r.url()}`); });

  await login(page);

  // 1. Open Garant Showcase and click a news item
  await page.goto(`http://localhost:3000/showcase/${PREVIEW_TOKEN}`);
  await page.waitForSelector('#news', { timeout: 10000 });
  await shot(page, '01-showcase-news-listing');

  await page.click(`#news a:has-text("${ORIGINAL_TITLE}")`);
  await page.waitForURL(`**/showcase/${PREVIEW_TOKEN}/news/**`, { timeout: 10000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  await shot(page, '02-showcase-news-detail');

  const detailTitle = await page.textContent('h1');
  const detailUrl = page.url();

  // 3. Open Studio News list
  await page.goto(`http://localhost:3000/studio/${SITE_ID}`);
  await page.waitForSelector('button:has-text("News")', { timeout: 10000 });
  await page.click('button:has-text("News")');
  await page.waitForSelector(`button:has-text("${ORIGINAL_TITLE}")`, { timeout: 10000 });
  await shot(page, '03-studio-news-list');

  // 4. Open the news editor
  await page.click(`button:has-text("${ORIGINAL_TITLE}")`);
  await page.waitForSelector('input[placeholder="Post title"]', { timeout: 10000 });
  await shot(page, '04-studio-news-editor-before');

  // 5. Change the title and save
  await page.fill('input[placeholder="Post title"]', TEST_TITLE);
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('text=Saved', { timeout: 10000 });
  await shot(page, '05-studio-news-editor-after');

  // 6. Refresh Showcase and verify the new title in listing
  await page.goto(`http://localhost:3000/showcase/${PREVIEW_TOKEN}`);
  await page.waitForSelector('#news', { timeout: 10000 });
  await shot(page, '06-showcase-news-listing-after-edit');
  const listingAfter = await page.textContent('#news');

  // 7. Open the same news detail (slug unchanged) and verify new title
  await page.click(`#news a:has-text("${TEST_TITLE}")`);
  await page.waitForURL(`**/showcase/${PREVIEW_TOKEN}/news/**`, { timeout: 10000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  await shot(page, '07-showcase-news-detail-after-edit');
  const detailAfterTitle = await page.textContent('h1');

  // 8. Restore original title in Studio
  await page.goto(`http://localhost:3000/studio/${SITE_ID}`);
  await page.waitForSelector('button:has-text("News")', { timeout: 10000 });
  await page.click('button:has-text("News")');
  await page.waitForSelector(`button:has-text("${TEST_TITLE}")`, { timeout: 10000 });
  await page.click(`button:has-text("${TEST_TITLE}")`);
  await page.waitForSelector('input[placeholder="Post title"]', { timeout: 10000 });
  await page.fill('input[placeholder="Post title"]', ORIGINAL_TITLE);
  await page.click('button:has-text("Save draft")');
  await page.waitForSelector('text=Saved', { timeout: 10000 });
  await shot(page, '08-studio-news-editor-restored');

  await browser.close();

  const result = {
    ok: true,
    detailTitle,
    detailUrl,
    listingAfter,
    detailAfterTitle,
    logs
  };

  const resultPath = join(OUT, 'news-qa-results.json');
  await writeFile(resultPath, JSON.stringify(result, null, 2));
  console.log('News QA results:', resultPath);
  console.log('detail title:', detailTitle);
  console.log('detail URL:', detailUrl);
  console.log('detail after edit:', detailAfterTitle);
}

run().catch((e) => { console.error(e); process.exit(1); });
