import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', (msg) => console.log('console', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('pageerror', err.message));
  page.on('response', (r) => { if (r.status() >= 400) console.log('http', r.status(), r.url()); });
  await page.goto('http://localhost:3000/showcase/ze6f3z0v');
  await page.waitForTimeout(3000);
  const html = await page.evaluate(() => ({ root: document.getElementById('root')?.innerHTML, body: document.body.innerHTML, cms: (window as any).__CMS__ }));
  console.log('root:', html.root);
  console.log('body snippet:', html.body.slice(0, 200));
  console.log('cms keys:', html.cms ? Object.keys(html.cms) : 'none');
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
