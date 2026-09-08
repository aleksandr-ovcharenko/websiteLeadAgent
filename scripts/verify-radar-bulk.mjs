import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.EMAIL || 'admin@minsk.local';
const PASSWORD = process.env.PASSWORD || 'admin123';

async function bulkAndGetResponse(p, action) {
  const promise = p.waitForResponse(r => r.url().includes('/api/leads/bulk') && r.request().method() === 'POST', { timeout: 15000 });
  await p.locator(`button:has-text("${action}")`).click();
  const res = await promise;
  const json = await res.json().catch(() => ({}));
  const ok = json.results?.filter((r) => r.result === 'success').length || 0;
  const skipped = json.results?.filter((r) => r.result === 'skipped').length || 0;
  const failed = json.results?.filter((r) => r.result === 'failed').length || 0;
  return { json, summary: `${action}: ${ok} succeeded${skipped ? `, ${skipped} skipped` : ''}${failed ? `, ${failed} failed` : ''}` };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });
  const p = await ctx.newPage();

  const log = (...args) => console.log('[verify]', ...args);

  try {
    await p.goto(`${BASE}/radar`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await p.locator('input[type="email"]').fill(EMAIL);
    await p.locator('input[type="password"]').fill(PASSWORD);
    await p.locator('button[type="submit"]').click();
    await p.locator('[data-testid="radar-lead-row"]').first().waitFor({ timeout: 20000 });
    log('logged in and Radar loaded');

    const allRows = await p.locator('[data-testid="radar-lead-row"]').all();
    const allIds = await Promise.all(allRows.map(async (r) => r.getAttribute('data-lead-id')));
    log('visible leads', allIds.length);
    if (allIds.length < 6) throw new Error('not enough leads to verify');

    const setA = allIds.slice(0, 3);
    const setB = allIds.slice(3, 6);
    const oneReaudit = allIds[3];

    // Approve set A
    for (const id of setA) await p.locator(`[data-lead-id="${id}"] input[type="checkbox"]`).check();
    const { summary: approveText } = await bulkAndGetResponse(p, 'Approve');
    log('approve result', approveText);
    await p.locator('[data-testid="lead-check-all"]').uncheck();

    // Reject set B
    for (const id of setB) await p.locator(`[data-lead-id="${id}"] input[type="checkbox"]`).check();
    const { summary: rejectText } = await bulkAndGetResponse(p, 'Reject');
    log('reject result', rejectText);
    await p.locator('[data-testid="lead-check-all"]').uncheck();

    // Re-audit one from set B
    await p.locator(`[data-lead-id="${oneReaudit}"] input[type="checkbox"]`).check();
    const { summary: reauditText } = await bulkAndGetResponse(p, 'Re-audit');
    log('reaudit result', reauditText);
    await p.locator('[data-testid="lead-check-all"]').uncheck();

    // Delete set B after reject/reaudit
    for (const id of setB) await p.locator(`[data-lead-id="${id}"] input[type="checkbox"]`).check();
    p.on('dialog', (d) => d.accept());
    const { summary: deleteText } = await bulkAndGetResponse(p, 'Delete');
    log('delete result', deleteText);

    // Verify the deleted rows no longer appear
    for (const id of setB) {
      const row = p.locator(`[data-lead-id="${id}"]`);
      await row.waitFor({ state: 'detached', timeout: 10000 });
    }
    log('deleted rows removed from DOM');

    console.log(JSON.stringify({ ok: true, approve: approveText, reject: rejectText, reaudit: reauditText, delete: deleteText }));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e.message }));
    await p.screenshot({ path: '/tmp/radar-bulk-fail.png' });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
