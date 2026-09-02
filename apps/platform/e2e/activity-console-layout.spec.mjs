import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const BASE = process.env.PLATFORM_URL || 'http://localhost:3004';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

async function startApp() {
  const port = new URL(BASE).port;
  const apiPort = process.env.PLATFORM_API_PORT || '3333';
  const proc = spawn('npx', ['vite'], {
    cwd: new URL('../', import.meta.url).pathname,
    stdio: 'pipe',
    env: { ...process.env, PLATFORM_WEB_PORT: port, PLATFORM_API_PORT: apiPort },
  });
  await new Promise((resolve, reject) => {
    let buf = '';
    const onData = (data) => {
      buf += data.toString();
      if (buf.includes('ready in')) {
        proc.stdout.off('data', onData);
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (d) => console.error(d.toString()));
    proc.on('error', reject);
    setTimeout(15000).then(() => reject(new Error('Vite did not start in time')));
  });
  return proc;
}

async function login(page) {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error('Set TEST_EMAIL and TEST_PASSWORD env vars to run this test against a real login.');
  }
  await page.goto(`${BASE}/radar`);
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  // wait for the Radar table or sidebar
  await page.waitForSelector('[data-testid="radar-leads-table"], .bg-white.border.border-\\[\\#e5e3df\\].rounded-md', { timeout: 10000 });
}

async function getBox(page, selector) {
  const el = await page.$(selector);
  if (!el) return null;
  return await el.boundingBox();
}

function assertNoOverlap(label, a, b) {
  if (!a || !b) throw new Error(`Missing elements for ${label}`);
  if (a.y + a.height > b.y) {
    throw new Error(`${label} overlaps the console: bottom=${a.y + a.height}, console.top=${b.y}`);
  }
}

const TEST_VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1366x768', width: 1366, height: 768 },
];

async function run() {
  let proc;
  if (!process.env.SKIP_START) {
    proc = await startApp();
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  try {
    await login(page);

    // 1. Collapsed console — ensure Qualify button in the table row is not covered.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'e2e/screenshots/01-radar-console-collapsed.png' });

    // Expand the Activity Console by clicking the toggle in App.tsx console header.
    await page.click('[data-testid="activity-console-toggle"]');
    await setTimeout(300);

    // 2. Expanded console — table still visible.
    await page.screenshot({ path: 'e2e/screenshots/02-radar-console-expanded.png' });

    // Open the first lead to test the Lead detail drawer.
    await page.click('[data-testid="radar-lead-row"]:first-child');
    await page.waitForSelector('[data-testid="lead-detail"]', { timeout: 10000 });

    // 3. Lead detail with console expanded.
    await page.screenshot({ path: 'e2e/screenshots/03-lead-detail-console-expanded.png' });

    // 4. Smaller viewport.
    await page.setViewportSize({ width: 1024, height: 768 });
    await setTimeout(300);
    await page.screenshot({ path: 'e2e/screenshots/04-small-viewport-console.png' });

    // Overlap assertions against real bounding boxes.
    const consoleBox = await getBox(page, '[data-testid="activity-console"]');
    const qualifyBox = await getBox(page, '[data-testid="qualify-button"]');
    const primaryBox = await getBox(page, '[data-testid="lead-detail-primary-action"]');
    const decisionsBox = await getBox(page, '[data-testid="lead-decision-buttons"]');

    if (!consoleBox) throw new Error('Activity Console not found');
    if (qualifyBox) assertNoOverlap('Qualify button', qualifyBox, consoleBox);
    if (primaryBox) assertNoOverlap('Lead detail primary action', primaryBox, consoleBox);
    if (decisionsBox) assertNoOverlap('Decision buttons', decisionsBox, consoleBox);

    // Test multiple viewports.
    for (const { name, width, height } of TEST_VIEWPORTS) {
      await page.setViewportSize({ width, height });
      await setTimeout(300);
      const c = await getBox(page, '[data-testid="activity-console"]');
      const q = await getBox(page, '[data-testid="qualify-button"]');
      const p = await getBox(page, '[data-testid="lead-detail-primary-action"]');
      const d = await getBox(page, '[data-testid="lead-decision-buttons"]');
      if (q) assertNoOverlap(`Qualify @ ${name}`, q, c);
      if (p) assertNoOverlap(`Primary action @ ${name}`, p, c);
      if (d) assertNoOverlap(`Decisions @ ${name}`, d, c);
    }

    console.log('PASS: no overlaps detected across viewports.');
  } finally {
    await browser.close();
    if (proc) {
      proc.kill('SIGTERM');
      await setTimeout(1000);
      if (!proc.killed) proc.kill('SIGKILL');
    }
  }
}

run().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
