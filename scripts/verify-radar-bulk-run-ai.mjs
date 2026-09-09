import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.EMAIL || 'admin@minsk.local';
const PASSWORD = process.env.PASSWORD || 'admin123';

// 5 eligible (audit SUCCESS + website FOUND, no rejected status, no active AI), 2 audit FAILED
const ELIGIBLE = [
  'cmtnjmlpc003g99lge9atinxe',
  'cmtnjmlow003199lgjkenk4bp',
  'cmtnjmlr3005499lgsjyy68bv',
  'cmtnjmlrb005d99lg480az3yr',
  'cmtnjmlnq001y99lg5u0l3l9n',
];
const AUDIT_FAILED_1 = 'cmtsjeloh005e11roqr9b6i1u';
const AUDIT_FAILED_2 = 'cmtsjelnv005211ro3az2he5s';
const SELECTED = [...ELIGIBLE, AUDIT_FAILED_1, AUDIT_FAILED_2];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const requests = [];

  p.on('request', (req) => {
    const url = req.url();
    if (req.method() === 'GET' && url.includes('/api/leads') && !url.includes('/api/leads/')) {
      requests.push({ method: req.method(), url });
    }
  });

  try {
    await p.goto(`${BASE}/radar`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await p.locator('input[type="email"]').fill(EMAIL);
    await p.locator('input[type="password"]').fill(PASSWORD);
    await p.locator('button[type="submit"]').click();
    await p.waitForSelector('[data-testid="radar-table"]', { timeout: 20000 });

    // Wait a tick for the row store subscription to populate
    await p.waitForTimeout(500);

    const visibleIds = await p.evaluate(() =>
      [...document.querySelectorAll('tr[data-lead-id]')].map((r) => r.getAttribute('data-lead-id'))
    );
    console.log(JSON.stringify({ visibleCount: visibleIds.length, sample: visibleIds.slice(0, 10) }));

    const missing = SELECTED.filter((id) => !visibleIds.includes(id));
    if (missing.length) {
      console.error(JSON.stringify({ ok: false, error: `Selected IDs not in visible table: ${missing.join(', ')}` }));
      await p.screenshot({ path: '/tmp/radar-bulk-run-ai-fail.png' });
      process.exitCode = 1;
      return;
    }

    for (const id of SELECTED) {
      const input = p.locator(`[data-lead-id="${id}"] input[type="checkbox"]`);
      await input.scrollIntoViewIfNeeded().catch(() => {});
      await input.click({ force: true });
      await p.waitForTimeout(50);
    }

    const checkedCount = await p.evaluate(() =>
      document.querySelectorAll('input[type="checkbox"]:checked').length
    );
    console.log(JSON.stringify({ checkedCount }));
    await p.screenshot({ path: '/tmp/radar-bulk-run-ai-debug.png' });

    // Capture network count just before clicking Run AI
    const startCount = requests.length;

    const bulkResponsePromise = p.waitForResponse((res) => res.url().includes('/api/leads/bulk') && res.status() === 200);
    await p.locator('[data-testid="bulk-run-ai"]').click();
    const bulkResponse = await (await bulkResponsePromise).json();
    console.log(JSON.stringify({ bulkResult: bulkResponse }));
    await p.locator('[data-testid="bulk-result"]').waitFor({ timeout: 15000 });

    const bulkText = await p.locator('[data-testid="bulk-result"]').textContent();
    console.log(JSON.stringify({ bulkSummary: bulkText }));

    // Wait for background operations to update row badges
    await p.waitForTimeout(20000);

    const fullListRequestsAfter = requests.length - startCount;
    console.log(JSON.stringify({ fullListRequestsAfter }));

    // Scroll an originally eligible lead into view so its updated AI badge is visible
    await p.locator('[data-lead-id="cmtnjmlpc003g99lge9atinxe"]').scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(500);

    await p.screenshot({ path: '/tmp/radar-bulk-run-ai.png' });
    if (fullListRequestsAfter !== 0) {
      console.error(JSON.stringify({ ok: false, error: `Bulk Run AI caused ${fullListRequestsAfter} GET /api/leads request(s)` }));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ ok: true, screenshot: '/tmp/radar-bulk-run-ai.png' }));
    }
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    await p.screenshot({ path: '/tmp/radar-bulk-run-ai-fail.png' });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
