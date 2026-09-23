import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST = 'generated-sites/v31-lishen/cinematic-portfolio/dist';
const OUT = 'data/redesign/v32';
const PORT = 4017;

const server = http.createServer((req, res) => {
  const root = path.resolve(DIST);
  const file = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  const ct = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': ct });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', async () => {
  const browser = await chromium.launch();
  for (const [w, h, name, mobile] of [[1440, 900, 'project-intro-desktop', false], [390, 844, 'project-intro-mobile', true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => document.getElementById('projects')?.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(400);
    await page.locator('#projects').screenshot({ path: `${OUT}/${name}.png` });
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log('intro screenshots written to', OUT);
});
