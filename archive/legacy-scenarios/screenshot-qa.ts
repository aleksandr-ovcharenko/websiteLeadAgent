import { chromium, Browser, Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'screenshots');

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function login(page: Page) {
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'admin@minsk.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('h1:has-text("WebsiteLeadAgent")', { timeout: 10000 });
}

async function shot(page: Page, name: string, full = true) {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: full });
  console.log('screenshot', p);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', (err) => { logs.push(`PAGEERROR: ${err.message}`); });
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`HTTP ${r.status()} ${r.url()}`); });

  await login(page);

  // Hub
  await shot(page, '00-hub');

  // Forge
  await page.goto('http://localhost:3000/forge');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => document.body.innerText.includes('Forge') || document.body.innerText.includes('Total sites'), { timeout: 5000 });
  await shot(page, '03-forge-all-real-sites');

  // Garant Studio
  await page.goto('http://localhost:3000/studio/cmtdkqiu50004crwd529otns8');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => document.body.innerText.includes('Dashboard') || document.body.innerText.includes('Site'), { timeout: 5000 });
  await shot(page, '05-studio-garant-dashboard');

  // Open site switcher if it exists
  try { await page.click('button:has-text("Garant")', { timeout: 1000 }); } catch {}
  await page.waitForTimeout(500);
  await shot(page, '06-studio-garant-site-switcher', false);

  // Second demo Studio
  await page.goto('http://localhost:3000/studio/cmtecurjw00034ikcns2j61e4');
  await page.waitForTimeout(1500);
  await shot(page, '07-studio-second-demo-dashboard');

  // Garant Showcase
  await page.goto('http://localhost:3000/showcase/8e25ix7c');
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount || 0) > 0 || document.body.innerText.trim().length > 0, { timeout: 5000 });
  await shot(page, '09-showcase-garant-desktop');

  // Mobile Garant
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/showcase/8e25ix7c');
  await page.waitForTimeout(1500);
  await shot(page, '11-showcase-garant-mobile');

  // Second demo Showcase desktop
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:3000/showcase/ze6f3z0v');
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount || 0) > 0 || document.body.innerText.trim().length > 0, { timeout: 5000 });
  await shot(page, '10-showcase-second-demo-desktop');

  // Mobile second
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/showcase/ze6f3z0v');
  await page.waitForTimeout(1500);
  await shot(page, '12-showcase-second-demo-mobile');

  await browser.close();

  // Write log
  const logPath = join(OUT, 'console-errors.log');
  await writeFile(logPath, logs.join('\n') || 'no fatal errors/warnings');
  console.log('Wrote', logPath);
}

run().catch(e => { console.error(e); process.exit(1); });
