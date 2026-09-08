import { chromium } from 'playwright';
const b = await chromium.launch();
const out = 'data/redesign/reference-quality';
const results = [];

async function withPage(viewport, fn) {
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport });
  await ctx.request.post('http://localhost:3000/api/auth/login', { data: { email: 'admin@minsk.local', password: 'admin123' } });
  const p = await ctx.newPage();
  try {
    await fn(p);
  } finally {
    await ctx.close();
  }
}

// A. /radar/providers -> Back to leads
await withPage({ width: 1600, height: 1000 }, async (p) => {
  await p.goto('http://localhost:3000/radar/providers', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.click('text=← Back to leads');
  await p.waitForTimeout(800);
  const url = p.url();
  const table = await p.locator('[data-testid=radar-lead-row]').count();
  results.push({ test: 'providers back to leads', url, hasTable: table > 0 });
  await p.screenshot({ path: `${out}/radar-sidebar-back-to-leads.png` });
});

// B. /radar/providers -> WLA logo
await withPage({ width: 1600, height: 1000 }, async (p) => {
  await p.goto('http://localhost:3000/radar/providers', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.click('button[title="Back to Radar"]');
  await p.waitForTimeout(800);
  const url = p.url();
  const table = await p.locator('[data-testid=radar-lead-row]').count();
  results.push({ test: 'logo from providers', url, hasTable: table > 0 });
});

// C. /forge -> WLA logo
await withPage({ width: 1600, height: 1000 }, async (p) => {
  await p.goto('http://localhost:3000/forge', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.click('button[title="Back to Radar"]');
  await p.waitForTimeout(800);
  results.push({ test: 'logo from forge', url: p.url() });
});

// D. /studio/:siteId -> WLA logo
await withPage({ width: 1600, height: 1000 }, async (p) => {
  const sites = await (await p.context().request.get('http://localhost:3000/api/cms/sites')).json();
  const siteId = sites?.sites?.[0]?.id;
  if (siteId) {
    await p.goto(`http://localhost:3000/studio/${siteId}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.click('button[title="Back to Radar"]');
    await p.waitForTimeout(800);
    results.push({ test: 'logo from studio', url: p.url() });
  } else {
    results.push({ test: 'logo from studio', url: 'no-site', skipped: true });
  }
});

// E. mobile drawer Back to leads
await withPage({ width: 390, height: 844 }, async (p) => {
  await p.goto('http://localhost:3000/radar/providers', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.click('[data-sidebar-toggle]');
  await p.waitForTimeout(600);
  await p.waitForTimeout(600);
  const visible = await p.locator('text=← Back to leads').count();
  await p.locator('text=← Back to leads').first().evaluate((el) => el.click());
  await p.waitForTimeout(800);
  results.push({ test: 'mobile back to leads', visible: visible > 0, url: p.url() });
});

await b.close();
console.log(JSON.stringify(results, null, 2));
