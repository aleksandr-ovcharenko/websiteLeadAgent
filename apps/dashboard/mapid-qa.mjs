import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'screenshots', 'mapid');
const SITE_ID = 'cmtiys1nq0003edb0vcy1u3zu';
const TOKEN = 'hgxpszhj';
const QA = 'МАПИД [QA]';
const ORIGINAL = 'Мапид';

async function login(page) {
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'admin@minsk.local');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('h1:has-text("WebsiteLeadAgent")', { timeout: 10000 });
}

async function waitForShowcase(page) {
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount || 0) > 0 || document.body.innerText.trim().length > 0, { timeout: 10000 });
  await page.waitForTimeout(800);
}

async function setCompanyName(page, value) {
  const res = await page.evaluate(async ({ siteId, value }) => {
    const r = await fetch(`/api/cms/sites/${siteId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ companyName: value })
    });
    return { status: r.status, text: await r.text() };
  }, { siteId: SITE_ID, value });
  if (res.status >= 400) throw new Error(`settings update failed: ${res.status} ${res.text}`);
  console.log(`set companyName -> ${value} (${res.status})`);
}

async function shot(page, name) {
  const p = join(OUT, `${name}.png`);
  await page.screenshot({ path: p });
  console.log('screenshot', p);
}

async function bodyContains(page, text) {
  return page.evaluate((t) => document.body.innerText.includes(t), text);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  let ok = false;

  try {
    await login(page);

    // 1. Factory / Radar
    await page.goto('http://localhost:3000/radar');
    await page.waitForFunction(() => document.body.innerText.includes('Мапид') || document.body.innerText.includes('Leads'), { timeout: 10000 });
    await shot(page, '01-mapid-factory');

    // 2. Forge
    await page.goto('http://localhost:3000/forge');
    await page.waitForFunction(() => document.body.innerText.includes('Forge') || document.body.innerText.includes('Total sites'), { timeout: 10000 });
    await shot(page, '02-mapid-forge');

    // 3. Studio settings
    await page.goto(`http://localhost:3000/studio/${SITE_ID}`);
    await page.waitForFunction(() => document.body.innerText.includes('Dashboard') || document.body.innerText.includes('Settings'), { timeout: 10000 });
    await shot(page, '03-mapid-studio-settings');

    // 4. Showcase home baseline
    await page.goto(`http://localhost:3000/showcase/${TOKEN}`);
    await waitForShowcase(page);
    const beforeText = await page.evaluate(() => document.body.innerText);
    console.log('before contains original:', beforeText.includes(ORIGINAL));
    await shot(page, '04-mapid-showcase-home');

    // Roundtrip: edit in Studio backend, verify in Showcase
    await setCompanyName(page, QA);
    await page.goto(`http://localhost:3000/showcase/${TOKEN}`);
    await waitForShowcase(page);
    const afterText = await page.evaluate(() => document.body.innerText);
    console.log('after contains QA:', afterText.includes(QA));
    await shot(page, '04-mapid-showcase-home-qa');
    if (!afterText.includes(QA)) throw new Error(`QA name not reflected in showcase`);

    // 5. Showcase contacts with QA name
    await page.goto(`http://localhost:3000/showcase/${TOKEN}/contacts`);
    await waitForShowcase(page);
    const contactsText = await page.evaluate(() => document.body.innerText);
    console.log('contacts contains QA:', contactsText.includes(QA));
    await shot(page, '05-mapid-showcase-contacts-qa');

    ok = true;
  } finally {
    // Always restore original display name
    try {
      await setCompanyName(page, ORIGINAL);
      await page.goto(`http://localhost:3000/showcase/${TOKEN}`);
      await waitForShowcase(page);
      const restoredText = await page.evaluate(() => document.body.innerText);
      console.log('restored contains original:', restoredText.includes(ORIGINAL));
    } catch (e) {
      console.error('restore failed', e);
    }
    await browser.close();
  }

  console.log('done', ok);
  if (!ok) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
