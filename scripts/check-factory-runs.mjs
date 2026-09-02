import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const leadId = 'cmthnoa4f004dtnq3jt3hcleo';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${base}/radar`);
await page.evaluate(() => fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@minsk.local', password: 'admin123' }),
  credentials: 'include'
}));

const res = await page.evaluate(async (leadId) => {
  const r = await fetch(`/api/factory/runs?leadId=${leadId}`, { credentials: 'include' });
  return { status: r.status, body: await r.text() };
}, leadId);

console.log(JSON.stringify(res, null, 2));
await browser.close();
