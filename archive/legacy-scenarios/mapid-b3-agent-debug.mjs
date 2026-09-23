import { exec } from 'node:child_process';
import { launchSandboxedBrowser } from '@minsk/security';

const server = exec('python3 -m http.server 3466 --directory /Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation/agent/render');
await new Promise(r => setTimeout(r, 1200));
const browser = await launchSandboxedBrowser({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3466/b3-agent.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const hero = document.querySelector('[data-bp-section="hero"]');
  const img = hero?.querySelector('img');
  const style = hero ? window.getComputedStyle(hero) : null;
  const imgStyle = img ? window.getComputedStyle(img) : null;
  return {
    heroClass: hero?.className,
    heroDisplay: style?.display,
    heroGridColumns: style?.gridTemplateColumns,
    heroHeight: style?.height,
    heroMinHeight: style?.minHeight,
    imgHeight: imgStyle?.height,
    imgWidth: imgStyle?.width,
    imgSrc: img?.src
  };
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
await browser.close();
server.kill();
