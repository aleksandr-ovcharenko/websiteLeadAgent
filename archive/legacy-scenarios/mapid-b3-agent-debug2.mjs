import { exec } from 'node:child_process';
import { launchSandboxedBrowser } from '@minsk/security';

const server = exec('python3 -m http.server 3468 --directory /Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation/agent/render');
await new Promise(r => setTimeout(r, 1200));
const browser = await launchSandboxedBrowser({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3468/b3-agent.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const section = document.querySelector('[data-bp-section="business-areas"]');
  const grid = section?.querySelector('.bp-areas-grid');
  return {
    sectionClass: section?.className,
    gridDisplay: window.getComputedStyle(grid).display,
    gridClass: grid?.className
  };
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
await browser.close();
server.kill();
