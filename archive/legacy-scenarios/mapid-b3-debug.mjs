import { launchSandboxedBrowser } from '@minsk/security';
import { exec } from 'node:child_process';

const server = exec('python3 -m http.server 3465 --directory /Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation/current/render');
await new Promise(r => setTimeout(r, 1200));

const browser = await launchSandboxedBrowser({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const consoleLogs = [];
const pageErrors = [];
page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', err => pageErrors.push(err.message));

try {
  await page.goto('http://localhost:3465/b3-current.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const html = await page.evaluate(() => ({ title: document.title, root: document.getElementById('root')?.innerHTML?.slice(0, 500), body: document.body.innerHTML?.slice(0, 500) }));
  console.log(JSON.stringify({ html, consoleLogs, pageErrors }, null, 2));
} catch (e) {
  console.error(e);
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
}
