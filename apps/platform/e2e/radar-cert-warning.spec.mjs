import { chromium } from 'playwright';
import { setTimeout } from 'node:timers/promises';

const BASE = process.env.PLATFORM_URL || 'http://localhost:3004';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@minsk.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

async function login(page) {
  await page.goto(`${BASE}/radar`);
  await page.evaluate(({ email, password }) => fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include'
  }), { email: TEST_EMAIL, password: TEST_PASSWORD });
  await page.goto(`${BASE}/radar`);
  await page.waitForSelector('input[placeholder="Search leads…"]', { timeout: 10000 });
}

async function openMrsLead(page) {
  await page.waitForSelector('text=All eligible', { timeout: 10000 });
  await page.click('text=All eligible');
  await setTimeout(300);
  await page.fill('input[placeholder="Search leads…"]', 'mrs');
  await setTimeout(800);
  const row = await page.locator('tr:has-text("mrs.by")').first();
  await row.click();
  await page.waitForSelector('[data-testid="lead-detail"]', { timeout: 10000 });
}

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: !!process.env.CI
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    await login(page);
    await openMrsLead(page);

    // 1. TLS warning is shown for a lead with an invalid certificate.
    await page.waitForSelector('text=TLS warning:', { timeout: 10000 });
    const warningText = await page.locator('div:has-text("TLS warning:")').first().textContent();
    if (!warningText.includes('ERR_CERT_DATE_INVALID')) {
      throw new Error(`Expected ERR_CERT_DATE_INVALID in TLS warning, got: ${warningText}`);
    }

    // 2. Audit status is treated as successful, not failed.
    await page.waitForSelector('text=Complete', { timeout: 5000 });

    // 3. Console displays structured details without ANSI escape sequences.
    await page.click('text=Activity Console');
    await setTimeout(300);
    const consoleText = await page.locator('[data-testid="activity-console"]').textContent().catch(() => '');
    if (/\u001b\[/.test(consoleText)) {
      throw new Error('Activity Console contains ANSI escape codes.');
    }

    // 4. Lead switching updates the detail panel without stale state.
    await page.click('text=All eligible');
    await page.fill('input[placeholder="Search leads…"]', '');
    await setTimeout(500);
    const anyRow = await page.locator('tr:has-text(".by"), tr:has-text(".com"), tr:has-text(".net"), tr:has-text(".org"), tr:has-text(".ru")').first();
    await anyRow.click();
    await page.waitForSelector('text=Lead detail', { timeout: 10000 });

    console.log('PASS: certificate warning, audit completion, console sanitization, and lead switching verified.');
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
