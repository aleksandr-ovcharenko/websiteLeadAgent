import { chromium } from 'playwright';
const b = await chromium.launch();
const out = 'data/redesign/reference-quality';

// desktop
let ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });
await ctx.request.post('http://localhost:3000/api/auth/login', { data: { email: 'admin@minsk.local', password: 'admin123' } });
let p = await ctx.newPage();
await p.goto('http://localhost:3000/radar', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3000);
await p.screenshot({ path: `${out}/radar-sidebar-open.png` });
await p.click('[data-sidebar-toggle]');
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/radar-sidebar-closed.png` });
await p.screenshot({ path: `${out}/radar-filters.png`, clip: { x: 220, y: 80, width: 1350, height: 180 } });
await ctx.close();

// mobile
ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
await ctx.request.post('http://localhost:3000/api/auth/login', { data: { email: 'admin@minsk.local', password: 'admin123' } });
p = await ctx.newPage();
await p.goto('http://localhost:3000/radar', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.waitForTimeout(3000);
await p.click('[data-sidebar-toggle]');
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/radar-sidebar-mobile.png` });
await ctx.close();

// dark desktop
ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });
await ctx.request.post('http://localhost:3000/api/auth/login', { data: { email: 'admin@minsk.local', password: 'admin123' } });
p = await ctx.newPage();
await p.goto('http://localhost:3000/radar', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await p.evaluate(() => { localStorage.setItem('theme', 'dark'); document.documentElement.dataset.theme = 'dark'; });
await p.waitForTimeout(3000);
await p.screenshot({ path: `${out}/platform-dark-radar.png` });
await ctx.close();

await b.close();
console.log('screenshots done');
