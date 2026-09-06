import { chromium } from 'playwright';
import { setTimeout } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

// Radar UX stability regression spec — requires real browser evidence:
//   * Playwright video + trace are recorded to ./e2e-artifacts/
//   * row bounding boxes + scrollTop are measured before/after live updates
//   * network calls are counted (leads / stats / lead detail / SSE)
//   * 60s+ scenario with multiple concurrently qualifying leads
//   * early-review controls must exist and persist before qualification
//
// Run: node apps/platform/e2e/radar-selection-early-review.spec.mjs

const BASE = process.env.PLATFORM_URL || 'http://localhost:3004';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@minsk.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';
const ARTIFACTS = path.resolve(process.cwd(), 'apps/platform/e2e/artifacts');
const RUN_SECONDS = Number(process.env.STABILITY_SECONDS || 60);

async function login(page) {
  await page.goto(`${BASE}/radar`);
  await page.evaluate(({ email, password }) => fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include'
  }), { email: TEST_EMAIL, password: TEST_PASSWORD });
  await page.goto(`${BASE}/radar`);
  await page.waitForSelector('[data-testid="radar-lead-row"]', { timeout: 15000 });
}

async function snapshotGeometry(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector('.overflow-y-auto');
    const rows = [...document.querySelectorAll('[data-testid="radar-lead-row"]')];
    const rect = (el) => el.getBoundingClientRect();
    const probe = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = rect(el);
      return { top: Math.round(r.top * 10) / 10, height: Math.round(r.height * 10) / 10 };
    };
    return {
      // Absolute viewport geometry — a parent collapse moves ALL rows
      // together, which row-relative comparisons cannot detect.
      scrollTop: scroller ? scroller.scrollTop : null,
      stats: probe('[data-testid="radar-stats"]'),
      filters: probe('[data-testid="radar-filters"]'),
      table: probe('[data-testid="radar-table"]'),
      detail: probe('[data-testid="lead-detail"]'),
      rows: rows.map((r) => ({
        id: r.getAttribute('data-lead-id'),
        top: Math.round(rect(r).top * 10) / 10,
        height: Math.round(rect(r).height * 10) / 10,
      })),
    };
  });
}

// Normal pointer-interaction sweep: every primary control must accept a real
// click with no interception while the detail panel is open.
async function interactionCheck(page) {
  const rows = page.locator('[data-testid="radar-lead-row"]');
  if ((await rows.count()) === 0) return;
  await rows.first().click(); // open detail panel first — worst case for overlap
  await page.waitForSelector('[data-testid="lead-detail"]', { timeout: 10000 });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: /All sites/ }).click();
  await page.locator('input[placeholder="Search leads…"]').fill('test');
  await page.locator('input[placeholder="Search leads…"]').fill('');
  await rows.first().click();
  const decision = page.locator('[data-testid="lead-decision-buttons"] button').nth(1);
  if (await decision.count()) {
    const leadId = await rows.first().getAttribute('data-lead-id');
    await decision.click();
    await setTimeout(500);
    // restore review state — this is an interaction check, not a data change
    await page.evaluate((id) => fetch(`/api/leads/${id}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status: 'UNREVIEWED' }),
    }), leadId);
  }
}

async function run() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: ARTIFACTS, size: { width: 1440, height: 900 } },
  });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => {
    const msg = String(e);
    // Vite HMR websocket noise: the dev client targets the gateway port
    // (vite.config hmr.clientPort) which isn't running under direct :3004
    // access — infrastructure noise, not application behavior.
    if (/WebSocket closed without opened|vite.*websocket/i.test(msg)) return;
    consoleErrors.push(msg);
  });

  // ── Network accounting ────────────────────────────────────────────────
  const net = { leads: 0, stats: 0, leadDetail: 0, sse: 0, other: 0 };
  const statsReqTimes = [];
  const statsRespTimes = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/\/api\/leads\?/.test(u)) net.leads++;
    else if (/\/api\/leads\/stats/.test(u)) { net.stats++; statsReqTimes.push(Date.now()); }
    else if (/\/api\/leads\/[^/?]+(\?|$)/.test(u) && !u.includes('/review') && !u.includes('/redesign')) net.leadDetail++;
    else if (u.includes('/api/activity/stream')) net.sse++;
    else if (u.includes('/api/')) net.other++;
  });
  page.on('response', (res) => {
    if (/\/api\/leads\/stats/.test(res.url())) statsRespTimes.push(Date.now());
  });

  const report = { net, assertions: [] };
  const check = (name, ok, detail = '') => {
    report.assertions.push({ name, ok, detail });
    if (!ok) throw new Error(`${name}: ${detail}`);
  };

  try {
    await login(page);

    const rows = page.locator('[data-testid="radar-lead-row"]');
    const rowCount = await rows.count();
    if (rowCount < 5) {
      console.log(`SKIP: need at least 5 leads, found ${rowCount}`);
      return;
    }

    // ── Select lead A (a middle row), scroll away from top ──────────────
    const mid = Math.min(4, rowCount - 1);
    const leadA = rows.nth(mid);
    const leadAId = await leadA.getAttribute('data-lead-id');
    const leadACompany = (await leadA.locator('td').first().locator('div').first().textContent())?.trim();
    await leadA.click();
    await page.waitForSelector('[data-testid="lead-detail"]', { timeout: 10000 });

    // Scroll the page so the table is not at the top.
    await page.evaluate(() => {
      const scroller = document.querySelector('.overflow-y-auto');
      if (scroller) scroller.scrollTop = Math.min(200, scroller.scrollHeight);
    });
    await setTimeout(500);

    const before = await snapshotGeometry(page);
    const netBefore = { ...net };

    // ── Start qualification on up to 3 other leads ──────────────────────
    let qualified = 0;
    for (let i = 0; i < Math.min(rowCount, 8) && qualified < 3; i++) {
      if (i === mid) continue;
      const q = rows.nth(i).locator('[data-testid="qualify-button"]');
      if (await q.count()) {
        await q.first().click();
        qualified++;
        await setTimeout(300);
      }
    }
    // Fallback: trigger qualification through the API for leads that have a
    // website, so the stability window always sees real stage transitions.
    if (qualified < 3) {
      const apiStarted = await page.evaluate(async (excludeId) => {
        const res = await fetch('/api/leads?limit=50', { credentials: 'include' });
        const items = (await res.json()).items || [];
        let n = 0;
        for (const l of items) {
          if (n >= 3) break;
          if (!l.website || l.id === excludeId) continue;
          const r = await fetch('/api/operations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ operationId: 'RUN_FULL_QUALIFICATION', input: { leadId: l.id }, leadId: l.id, entityType: 'Lead', entityId: l.id }),
          });
          if (r.ok) n++;
        }
        return n;
      }, leadAId);
      qualified += apiStarted;
    }

    // ── Live stability window ───────────────────────────────────────────
    const endAt = Date.now() + RUN_SECONDS * 1000;
    const topSamples = new Map(); // id -> [tops]
    const containerSamples = [];  // absolute geometry of stats/filters/table
    let detailFlashes = 0;
    let skeletonSeen = false;
    while (Date.now() < endAt) {
      const g = await snapshotGeometry(page);
      containerSamples.push({ t: Date.now(), stats: g.stats, filters: g.filters, table: g.table });
      for (const r of g.rows) {
        const arr = topSamples.get(r.id) ?? [];
        arr.push(r.top);
        topSamples.set(r.id, arr);
      }
      const detailVisible = await page.locator('[data-testid="lead-detail"]').isVisible().catch(() => false);
      if (!detailVisible) detailFlashes++;
      const skeleton = await page.locator('text=Loading leads…').isVisible().catch(() => false);
      if (skeleton) skeletonSeen = true;
      await setTimeout(1000);
    }

    const after = await snapshotGeometry(page);

    // ── Assertions ──────────────────────────────────────────────────────
    const detail = page.locator('[data-testid="lead-detail"]');
    check('detail-mounted', await detail.isVisible(), 'detail panel unmounted');
    const heading = await detail.locator('h2').first().textContent().catch(() => '');
    check('selection-authoritative', heading.includes(leadACompany || '___'), `detail shows "${heading}", expected "${leadACompany}"`);

    check('scrollTop-stable', before.scrollTop === after.scrollTop, `${before.scrollTop} -> ${after.scrollTop}`);

    // Row order + positions for rows present before AND after.
    const beforeIds = before.rows.map((r) => r.id);
    const afterIds = after.rows.map((r) => r.id);
    const common = beforeIds.filter((id) => afterIds.includes(id));
    const beforeOrder = common.join(',');
    const afterOrderFiltered = afterIds.filter((id) => common.includes(id)).join(',');
    check('row-order-stable', beforeOrder === afterOrderFiltered, `order changed: ${beforeOrder} -> ${afterOrderFiltered}`);

    // Row geometry: tops may shift only by scroll delta (0 expected).
    const beforeMap = new Map(before.rows.map((r) => [r.id, r]));
    const afterMap = new Map(after.rows.map((r) => [r.id, r]));
    let maxDrift = 0;
    let driftRow = null;
    for (const id of common) {
      const drift = Math.abs((beforeMap.get(id)?.top ?? 0) - (afterMap.get(id)?.top ?? 0));
      if (drift > maxDrift) { maxDrift = drift; driftRow = id; }
    }
    check('row-geometry-stable', maxDrift <= 2, `max top drift ${maxDrift}px on row ${driftRow}`);

    let maxHeightDelta = 0;
    for (const id of common) {
      const dh = Math.abs((beforeMap.get(id)?.height ?? 0) - (afterMap.get(id)?.height ?? 0));
      if (dh > maxHeightDelta) maxHeightDelta = dh;
    }
    check('row-height-stable', maxHeightDelta <= 1, `max height delta ${maxHeightDelta}px`);

    check('no-skeleton-after-load', !skeletonSeen, 'skeleton appeared during background updates');
    check('detail-never-unmounted', detailFlashes === 0, `detail unmounted ${detailFlashes}x`);

    // Absolute parent geometry: the stats block, filter bar and table must
    // never collapse or shift vertically during background polling.
    const statsHeights = containerSamples.map((s) => s.stats?.height).filter((h) => h != null);
    const minStatsH = Math.min(...statsHeights);
    const maxStatsH = Math.max(...statsHeights);
    check('stats-height-stable', maxStatsH - minStatsH <= 1, `stats height ${minStatsH}..${maxStatsH}px (${containerSamples.length} samples)`);
    const filtersTops = containerSamples.map((s) => s.filters?.top).filter((t) => t != null);
    const maxFiltersDrift = Math.max(...filtersTops) - Math.min(...filtersTops);
    check('filters-top-stable', maxFiltersDrift <= 1, `filters top drift ${maxFiltersDrift}px`);
    const tableTops = containerSamples.map((s) => s.table?.top).filter((t) => t != null);
    const maxTableDrift = Math.max(...tableTops) - Math.min(...tableTops);
    check('table-top-stable', maxTableDrift <= 1, `table top drift ${maxTableDrift}px`);

    // Correlate stats requests with any layout movement.
    report.statsRequestTimestamps = statsReqTimes.length;
    report.containerSamplesCount = containerSamples.length;

    // ── Early review availability on an incomplete lead ─────────────────
    const decisionButtons = page.locator('[data-testid="lead-decision-buttons"] button');
    const btnCount = await decisionButtons.count();
    check('early-review-buttons-present', btnCount === 3, `found ${btnCount}`);

    // ── Stale row: background removal keeps the row, marked, no jump ────
    await page.getByRole('button', { name: /Ready for review/ }).click();
    await page.waitForSelector('[data-testid="radar-lead-row"]', { timeout: 10000 });
    await setTimeout(1500);
    const filtered = page.locator('[data-testid="radar-lead-row"]');
    if ((await filtered.count()) > 0) {
      const staleTargetId = await filtered.first().getAttribute('data-lead-id');
      // A background state change drops this row from the filtered view.
      await page.evaluate((id) => fetch(`/api/leads/${id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: 'BAD' }),
      }), staleTargetId);
      await setTimeout(4500); // SSE debounce + reconcile
      const staleRow = page.locator(`[data-lead-id="${staleTargetId}"]`);
      check('stale-row-kept-in-snapshot', (await staleRow.count()) === 1, 'background update removed the row');
      const staleText = await staleRow.textContent().catch(() => '');
      check('stale-row-marked', staleText.includes('Moved out of current view'), `no stale marker: ${staleText?.slice(0, 80)}`);
      const heading2 = await page.locator('[data-testid="lead-detail"] h2').first().textContent().catch(() => '');
      check('selection-survives-bg-removal', heading2.includes(leadACompany || '___'), `selection moved: detail shows "${heading2}"`);
      // Explicit refresh boundary rebuilds membership from the server.
      // A normal click must work — the detail panel takes real layout space
      // and may not intercept unrelated controls.
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await setTimeout(2500);
      check('stale-row-removed-on-refresh', (await page.locator(`[data-lead-id="${staleTargetId}"]`).count()) === 0, 'stale row survived explicit refresh');
      // Restore test data.
      await page.evaluate((id) => fetch(`/api/leads/${id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ status: 'UNREVIEWED' }),
      }), staleTargetId);
    }

    report.networkDuringRun = {
      leadsCalls: net.leads - netBefore.leads,
      statsCalls: net.stats - netBefore.stats,
      leadDetailCalls: net.leadDetail - netBefore.leadDetail,
      sseConnections: net.sse,
      otherApiCalls: net.other - netBefore.other,
      qualifiedLeads: qualified,
      seconds: RUN_SECONDS,
    };

    // ── Multi-viewport pointer-interaction check ────────────────────────
    for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(vp);
      await setTimeout(500);
      await interactionCheck(page);
      report.assertions.push({ name: `interactions-${vp.width}x${vp.height}`, ok: true, detail: 'all controls clicked normally' });
    }

    if (consoleErrors.length) throw new Error(`Page errors: ${consoleErrors.join('; ')}`);

    console.log(JSON.stringify(report, null, 2));
    console.log(`PASS: ${RUN_SECONDS}s live stability run — selection, scroll, row order and geometry stable; ${qualified} leads qualified in background.`);
  } finally {
    const tracePath = path.join(ARTIFACTS, 'radar-stability-trace.zip');
    await ctx.tracing.stop({ path: tracePath });
    await ctx.close();
    await browser.close();
    const videos = fs.readdirSync(ARTIFACTS)
      .filter((f) => f.endsWith('.webm'))
      .map((f) => ({ f, m: fs.statSync(path.join(ARTIFACTS, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    for (const { f } of videos) {
      if (f === 'radar-stability.webm') continue;
      fs.renameSync(path.join(ARTIFACTS, f), path.join(ARTIFACTS, 'radar-stability.webm'));
      break;
    }
    console.log(`Artifacts: ${path.join(ARTIFACTS, 'radar-stability.webm')} / radar-stability-trace.zip`);
  }
}

run().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
