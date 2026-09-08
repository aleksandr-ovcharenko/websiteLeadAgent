import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
const [label, duration] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
  recordVideo: { dir: 'data/redesign/reference-quality', size: { width: 1600, height: 1000 } },
});
await ctx.request.post('http://localhost:3000/api/auth/login', { data: { email: 'admin@minsk.local', password: 'admin123' } });
const p = await ctx.newPage();
p.on('console', (m) => { if (/RADAR_VIEW_LOAD|Loading stats|PAGEERROR/i.test(m.text())) console.log(m.text().slice(0, 180)); });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/radar', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3000);
await p.evaluate(() => {
  window.__t0 = Date.now();
  window.__mut = [];
  const obs = new MutationObserver((recs) => {
    for (const r of recs) {
      const target = r.target;
      const name = target?.dataset?.testid || target?.tagName?.toLowerCase() || '';
      const cls = target?.className?.toString?.().slice(0, 50) || '';
      window.__mut.push({ t: Date.now() - window.__t0, type: r.type, attr: r.attributeName, testid: name, cls });
    }
  });
  obs.observe(document.querySelector('#root'), { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-testid'], childList: true });
});
await p.waitForTimeout(+duration * 1000);
const log = await p.evaluate(() => window.__mut);
const path = await p.video()?.path?.();
await ctx.close();
console.log('DONE path=', path, 'mutations=', log.length);
writeFileSync(`data/redesign/reference-quality/radar-${label}-mut.json`, JSON.stringify(log));
