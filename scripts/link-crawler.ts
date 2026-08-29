import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'screenshots', 'link-crawler');
const BASE = 'http://localhost:3000';
const TOKEN = '8e25ix7c';
const START = `${BASE}/showcase/${TOKEN}`;

const PAGES_TO_CRAWL = [
  `${BASE}/showcase/${TOKEN}`,
  `${BASE}/showcase/${TOKEN}/about`,
  `${BASE}/showcase/${TOKEN}/contacts`,
  `${BASE}/showcase/${TOKEN}/services`,
  `${BASE}/showcase/${TOKEN}/projects`,
  `${BASE}/showcase/${TOKEN}/news`,
  `${BASE}/showcase/${TOKEN}/vacancies`,
];

type Link = {
  page: string;
  text: string;
  href: string;
  status: number | null;
  classification: string;
};

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs: string[] = [];
  page.on('console', (msg: any) => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', (err: any) => { logs.push(`PAGEERROR: ${err.message}`); });

  const all: Link[] = [];
  const seen = new Set<string>();

  for (const p of PAGES_TO_CRAWL) {
    try {
      await page.goto(p, { waitUntil: 'networkidle', timeout: 15000 });
      await page.screenshot({ path: join(OUT, `crawl-${p.replace(/[^a-z0-9]/gi, '_')}.png`), fullPage: false });
      const links: { text: string; href: string }[] = await page.$$eval('a', (as: any[]) => as.map(a => ({ text: (a.textContent || '').trim().slice(0, 80), href: a.getAttribute('href') || '' })));
      for (const l of links) {
        const fullHref = new URL(l.href || '#', p).href;
        const key = `${p}||${l.text}||${fullHref}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const isPlaceholder = (l.href || '#') === '#';
        const isAnchor = (l.href || '').startsWith('#') && !isPlaceholder;
        const isExternal = fullHref.startsWith('http') && !fullHref.includes('localhost:3000');
        const isAction = /^(tel:|mailto:|sms:)/.test(l.href || '');
        let status: number | null = null;
        let classification = 'UNKNOWN';
        if (isPlaceholder) classification = 'PLACEHOLDER';
        else if (isAnchor) classification = 'ANCHOR';
        else if (isAction) classification = 'VALID_ACTION';
        else if (isExternal) classification = 'EXTERNAL';
        else {
          try {
            const r = await fetch(fullHref, { method: 'HEAD', redirect: 'follow' });
            status = r.status;
            classification = status >= 200 && status < 400 ? 'VALID_INTERNAL' : 'BROKEN';
          } catch {
            classification = 'BROKEN';
          }
        }
        all.push({ page: p, text: l.text, href: fullHref, status, classification });
      }
    } catch (e: any) {
      logs.push(`CRAWL_ERROR: ${p} ${e.message}`);
    }
  }

  await browser.close();

  const broken = all.filter((l) => l.classification === 'BROKEN' || l.classification === 'PLACEHOLDER');
  const report = {
    ok: broken.length === 0,
    total: all.length,
    summary: {
      VALID_INTERNAL: all.filter(l => l.classification === 'VALID_INTERNAL').length,
      ANCHOR: all.filter(l => l.classification === 'ANCHOR').length,
      VALID_ACTION: all.filter(l => l.classification === 'VALID_ACTION').length,
      EXTERNAL: all.filter(l => l.classification === 'EXTERNAL').length,
      PLACEHOLDER: all.filter(l => l.classification === 'PLACEHOLDER').length,
      BROKEN: all.filter(l => l.classification === 'BROKEN').length,
      UNKNOWN: all.filter(l => l.classification === 'UNKNOWN').length,
    },
    links: all,
    broken,
    logs
  };

  const path = join(OUT, 'link-crawler-results.json');
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log('Link crawler done:', path);
  console.log('Summary:', report.summary);
  if (broken.length) console.log('Broken / placeholders:', broken.map(b => `${b.page} — ${b.text} → ${b.href}`).join('\n'));
}

run().catch((e) => { console.error(e); process.exit(1); });
