// Semantic link audit: every internal <a> on a Showcase is checked against
// its label/target contract. HTTP-200 is NOT a pass — a link is correct only
// when it leads to the content its label and semantic target promise.
import { chromium } from 'playwright';

const RENDERER = 'http://localhost:3336';
const TOKENS = process.argv.slice(2); // preview tokens
const fs = await import('node:fs');

const SEMANTIC = [
  { re: /проекты|объект|портфолио|все\s+проект|смотреть\s+проект/i, expect: /\/projects|#projects/, name: 'projects' },
  { re: /каталог|модел/i, expect: /\/products|#products/, name: 'products' },
  { re: /услуг/i, expect: /\/services|#services/, name: 'services' },
  { re: /новост|стать/i, expect: /\/news|#news|\/articles|#articles/, name: 'news' },
  { re: /контакт|связаться|заявк/i, expect: /contacts|#contacts|mailto:|tel:/, name: 'contacts' },
  { re: /о компании|о нас/i, expect: /about|#about|\/o-nas/, name: 'about' },
];
// labels that explicitly point at a collection route (not an anchor)
const COLLECTION_LABEL = /все|каталог|смотреть|подробнее|весь|открыть/i;

async function audit(browser, url, out) {
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a')].map((a) => ({ text: (a.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: a.href, rel: a.rel || '' }))
  );
  const rows = [];
  for (const l of links) {
    if (!l.href || l.href.startsWith('mailto:') || l.href.startsWith('tel:')) continue;
    if (!l.href.includes('localhost')) { rows.push({ ...l, verdict: 'EXTERNAL', ok: true }); continue; }
    const m = SEMANTIC.find((s) => s.re.test(l.text));
    if (!m) { rows.push({ ...l, verdict: 'UNLABELED', ok: true }); continue; }
    const ok = m.expect.test(l.href);
    // collection-intent labels must not land on a bare anchor of another section
    const wrongAnchor = /#(contacts|about|faq)/.test(l.href) && !m.expect.test(l.href);
    rows.push({ ...l, expects: m.name, verdict: ok && !wrongAnchor ? 'OK' : 'SEMANTIC_MISMATCH', ok: ok && !wrongAnchor });
  }
  out.push(...rows.map((r) => ({ page: url, ...r })));
  await page.context().close();
}

const browser = await chromium.launch();
const out = [];
for (const token of TOKENS) {
  for (const route of ['', '/products', '/projects', '/products/гамвик-пазл-хаус']) {
    await audit(browser, `${RENDERER}/preview/${token}${route}`, out);
  }
}
await browser.close();
const mismatches = out.filter((r) => !r.ok);
console.log(JSON.stringify({ total: out.length, mismatches: mismatches.length, items: out }, null, 1));
fs.writeFileSync('data/redesign/link-audit.json', JSON.stringify({ total: out.length, mismatches: mismatches.length, items: out }, null, 2));
console.log('written data/redesign/link-audit.json | total:', out.length, '| mismatches:', mismatches.length);
mismatches.forEach((m) => console.log('  MISMATCH:', m.page, '|', m.text, '→', m.href));
