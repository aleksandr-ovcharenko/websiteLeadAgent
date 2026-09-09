import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.EMAIL || 'admin@minsk.local';
const PASSWORD = process.env.PASSWORD || 'admin123';

const MANUAL = `Строительная компания NonExistent;https://nonexistent-minsk.by/
Хоккейный клуб;https://hockey-test.by
NonExistent;https://www.nonexistent-minsk.by/contact
sdke.by`;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();

  try {
    await p.goto(`${BASE}/radar/history`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await p.locator('input[type="email"]').fill(EMAIL);
    await p.locator('input[type="password"]').fill(PASSWORD);
    await p.locator('button[type="submit"]').click();
    await p.waitForSelector('[data-testid="radar-table"], button:has-text("+ New discovery")', { timeout: 20000 });

    await p.click('button:has-text("+ New discovery")');
    await p.waitForSelector('select[name="provider"]', { timeout: 10000 });
    await p.selectOption('select[name="provider"]', 'manual');
    await p.fill('input[name="query"]', 'генподрядчик');
    await p.fill('input[placeholder*="Минск"]', 'Минск');
    await p.fill('textarea[name="manualEntries"]', MANUAL);

    const startPromise = p.waitForResponse(r => r.url().includes('/api/operations') && r.request().method() === 'POST', { timeout: 120000 });
    await p.click('button:has-text("Start discovery")');
    await startPromise;

    await p.waitForSelector('[data-testid="operation-console"]', { timeout: 120000 });
    await p.click('button:has-text("Close")');

    // Wait for the new manual run to appear with 4 candidates
    await p.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody tr');
      return Array.from(rows).some((r) => r.textContent?.includes('4 found'));
    }, { timeout: 20000 });

    // Click the row with 4 found
    const fourRow = p.locator('tbody tr:has-text("4 found")');
    await fourRow.click();

    // Wait for counts
    await p.locator('[data-testid="discovery-counts"]').waitFor({ timeout: 15000 });
    await p.locator('[data-testid="discovery-added"]').waitFor({ timeout: 15000 });

    const counts = await p.locator('[data-testid="discovery-counts"]').textContent();
    console.log(JSON.stringify({ ok: true, counts }));

    await p.screenshot({ path: '/tmp/discovery-run-summary.png' });

    // expand Added
    await p.click('[data-testid="discovery-added"] button');
    await p.locator('[data-testid="discovery-added"] .text-text.font-medium').waitFor({ timeout: 5000 });
    await p.screenshot({ path: '/tmp/discovery-run-added-leads.png' });

    // expand Filtered
    await p.click('[data-testid="discovery-filtered"] button');
    await p.locator('[data-testid="discovery-filtered"] .text-text.font-medium').waitFor({ timeout: 5000 });
    await p.screenshot({ path: '/tmp/discovery-run-filtered.png' });
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    await p.screenshot({ path: '/tmp/discovery-gate-fail.png' });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
