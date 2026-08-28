import { chromium } from 'playwright';
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'http://localhost:3335/preview/frrx8v2h'\;
  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 1024, height: 768 },
    { name: 'mobile', width: 390, height: 844 },
  ];
  for (const v of viewports) {
    await page.setViewportSize({ width: v.width, height: v.height });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `/tmp/capture2-${v.name}.png`, fullPage: true });
  }
  await browser.close();
  console.log('done');
}
main().catch(e => { console.error(e); process.exit(1); });
