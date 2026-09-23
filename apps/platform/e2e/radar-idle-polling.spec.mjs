// V3.7.5 Part A — Radar idle-polling contract.
//  1. Idle Radar (no active runs): 30s of network observation must show no
//     repeated GETs for lead stats / discovery runs / lead list; table,
//     selection, scroll and filters stay untouched.
//  2. A RUNNING run: only that run's detail endpoint is polled (bounded
//     backoff) — the list and the lead table are not reloaded.
//  3. Terminal status: run polling stops immediately; one stats refresh.
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.PLATFORM_URL || 'http://localhost:3004';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@minsk.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

const RUNNING_RUN = {
  id: 'v375-mock-run', provider: 'dgis', query: 'mock query', location: 'Минск',
  limit: 10, status: 'RUNNING', collected: 3, createdCount: 1, duplicateCount: 0,
  rejectedCount: 0, uncertainCount: 0, createdAt: new Date().toISOString(),
};

function makeCounter() {
  const counts = { stats: 0, runsList: 0, runDetail: 0, leads: 0, sse: 0 };
  const matcher = (url) => {
    if (url.includes('/api/leads/stats')) counts.stats++;
    else if (/\/api\/discovery\/runs\/[^/?]+/.test(url)) counts.runDetail++;
    else if (url.includes('/api/discovery/runs')) counts.runsList++;
    else if (/\/api\/leads(\?|$)/.test(url)) counts.leads++;
    else if (url.includes('/api/activity/stream')) counts.sse++;
  };
  return { counts, matcher };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const { counts, matcher } = makeCounter();
  page.on('request', (req) => { if (req.method() === 'GET') matcher(req.url()); });

  let runStatus = 'RUNNING';
  let mockRuns = [];
  await page.route('**/api/discovery/runs?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: mockRuns, count: mockRuns.length }) }));
  await page.route(`**/api/discovery/runs/${RUNNING_RUN.id}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ run: { ...RUNNING_RUN, status: runStatus } }) }));
  await page.route('**/api/activity/stream*', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: ':ok\n\n' }));

  try {
    // ---- login --------------------------------------------------------------
    await page.goto(`${BASE}/radar`);
    await page.evaluate(({ email, password }) => fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }), credentials: 'include',
    }), { email: TEST_EMAIL, password: TEST_PASSWORD });
    await page.goto(`${BASE}/radar`);
    await page.waitForSelector('[data-testid="radar-table"], input[placeholder="Search leads…"]', { timeout: 15000 });
    await sleep(1500); // initial loads settle

    // ---- PHASE 1: idle, 30s of network silence on stats/runs/leads ----------
    const firstRow = page.locator('[data-testid="radar-lead-row"]').first();
    if (await firstRow.count()) {
      await firstRow.click();
      await page.waitForSelector('[data-testid="lead-detail"]', { timeout: 8000 }).catch(() => {});
    }
    const scrollEl = 'div.flex-1.flex.flex-col.min-w-0.overflow-y-auto';
    await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.scrollTop = 200; }, scrollEl);

    const snapshotBefore = await page.locator('[data-testid="radar-table"]').innerHTML().catch(() => '');
    const scrollBefore = await page.evaluate((sel) => document.querySelector(sel)?.scrollTop ?? -1, scrollEl);
    const selectedBefore = await page.locator('[data-testid="lead-detail"] [data-lead-id], [data-testid="lead-detail"]').first().getAttribute('data-lead-id').catch(() => null);
    const filterBefore = await page.locator('input[placeholder="Search leads…"]').inputValue().catch(() => '');

    const base = { ...counts };
    console.log('idle watch: 30s…');
    await sleep(30000);

    const delta = {
      stats: counts.stats - base.stats,
      runsList: counts.runsList - base.runsList,
      runDetail: counts.runDetail - base.runDetail,
      leads: counts.leads - base.leads,
    };
    console.log('idle deltas:', JSON.stringify(delta));
    if (delta.stats > 0 || delta.runsList > 0 || delta.runDetail > 0 || delta.leads > 0) {
      throw new Error(`idle radar issued repeated requests: ${JSON.stringify(delta)}`);
    }

    const snapshotAfter = await page.locator('[data-testid="radar-table"]').innerHTML().catch(() => '');
    const scrollAfter = await page.evaluate((sel) => document.querySelector(sel)?.scrollTop ?? -1, scrollEl);
    const filterAfter = await page.locator('input[placeholder="Search leads…"]').inputValue().catch(() => '');
    const detailOpen = await page.locator('[data-testid="lead-detail"]').count();
    if (snapshotBefore !== snapshotAfter) throw new Error('idle radar rebuilt the lead table');
    if (scrollBefore !== scrollAfter) throw new Error(`scroll moved: ${scrollBefore} -> ${scrollAfter}`);
    if (filterBefore !== filterAfter) throw new Error('filter changed while idle');
    if (selectedBefore && !detailOpen) throw new Error('selected lead was closed while idle');
    console.log('idle phase OK — zero repeated stats/runs/leads GETs; table, scroll, filter, selection stable');

    // ---- PHASE 2: a RUNNING run — only its detail endpoint is watched -------
    mockRuns = [{ ...RUNNING_RUN }];
    await page.reload();
    await page.waitForSelector('[data-testid="radar-table"], input[placeholder="Search leads…"]', { timeout: 15000 });
    await sleep(1500);
    const base2 = { ...counts };
    await sleep(12000); // ~3 watcher ticks at 2s→4s→8s backoff
    const d2 = {
      runDetail: counts.runDetail - base2.runDetail,
      runsList: counts.runsList - base2.runsList,
      stats: counts.stats - base2.stats,
      leads: counts.leads - base2.leads,
    };
    console.log('running deltas:', JSON.stringify(d2));
    if (d2.runDetail < 1) throw new Error('run watcher never polled the active run');
    if (d2.runsList > 0 || d2.leads > 0) throw new Error(`running phase reloaded list/leads: ${JSON.stringify(d2)}`);
    console.log(`running phase OK — ${d2.runDetail} run-detail polls, no list/table reload`);

    // ---- PHASE 3: terminal — polling stops immediately -----------------------
    runStatus = 'COMPLETED';
    await sleep(9000); // let the watcher see the terminal state
    const base3 = { ...counts };
    await sleep(12000);
    const d3 = { runDetail: counts.runDetail - base3.runDetail, stats: counts.stats - base3.stats };
    console.log('post-terminal deltas:', JSON.stringify(d3));
    if (d3.runDetail > 0) throw new Error(`polling continued after terminal status (${d3.runDetail} extra polls)`);
    if (d3.stats > 1) throw new Error(`more than one stats refresh after terminal (${d3.stats})`);
    console.log('terminal phase OK — watcher stopped; stats refreshed once');

    console.log('PASS: radar idle-polling contract');
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
