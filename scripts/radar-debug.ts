import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
  page.on('requestfailed', (req) => console.log('REQUESTFAILED', req.url(), req.failure()?.errorText));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  const heading = await page.locator('h1:has-text("Platform Admin")').first();
  if (await heading.isVisible().catch(() => false)) {
    await page.click('button:has-text("Sign in")');
    await page.waitForSelector('text=Business website generation platform', { timeout: 10000 });
  }

  console.log('--- navigating to /radar ---');
  await page.goto(`${BASE}/radar`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/radar-debug.png', fullPage: true });
  console.log('screenshot saved /tmp/radar-debug.png');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
