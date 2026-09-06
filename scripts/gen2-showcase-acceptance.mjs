// Phase 2B-B acceptance: render each showcase, desktop+mobile screenshots,
// internal link audit, console-error check.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3336';
const TOKENS = { lishen: '9srfe7fk5g', puzzlehouse: 'yu7kn146wn', sdke: '1gpw06ptql' };
const OUT = 'data/redesign/pilot-2b';

const browser = await chromium.launch();
const report = {};
for (const [key, token] of Object.entries(TOKENS)) {
  const dir = path.join(OUT, key);
  const shotDir = path.join(dir, 'screenshots');
  fs.mkdirSync(shotDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  const home = `${BASE}/showcase/${token}`;
  await page.goto(home, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => errors.push('goto: ' + e.message));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotDir, 'desktop-home.png'), fullPage: false });
  const title = await page.title();
  const bodyText = (await page.evaluate(() => document.body?.innerText || '')).slice(0, 3000);
  const links = await page.$$eval('a[href]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);

  // link audit: internal routes resolve to 200-rendered pages
  const linkResults = [];
  const internal = links.filter((l) => l && !l.startsWith('http') && !l.startsWith('mailto:') && !l.startsWith('tel:')).slice(0, 25);
  for (const l of internal) {
    const p2 = await ctx.newPage();
    const url = `${home}${l.startsWith('/') ? l : '/' + l}`;
    const r = await p2.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    linkResults.push(`${l} -> ${r ? r.status() : 'ERR'}`);
    await p2.close();
  }
  const externalSourceLinks = links.filter((l) => l && l.startsWith('http') && !l.includes('localhost'));

  // mobile shot
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const mp = await mctx.newPage();
  await mp.goto(home, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: path.join(shotDir, 'mobile-home.png') });
  await mctx.close();

  report[key] = { home, title, bodySample: bodyText.slice(0, 900), links, linkResults, externalSourceLinks, consoleErrors: errors };
  await ctx.close();
  console.log(`${key}: title="${title}" links=${links.length} consoleErrors=${errors.length} externalSource=${externalSourceLinks.length}`);
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'acceptance-report.json'), JSON.stringify(report, null, 2));
console.log(`report: ${OUT}/acceptance-report.json`);
