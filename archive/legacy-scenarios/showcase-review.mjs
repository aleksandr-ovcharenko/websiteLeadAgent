// Independent browser review of structured content on the canonical showcase.
// Routes: home, faq, services/monolit, contacts (generic page), licenses.
// Viewports: 1440, 1024, 768, 390, 320. Asserts + screenshots → data/redesign/v362.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000/showcase/3fx5dct2';
const OUT = 'data/redesign/v362';
const SHOTS = path.join(OUT, 'after');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(ok ? ' PASS' : ' FAIL', name, '|', String(detail).slice(0, 140));
};
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

const ROUTES = [
  { slug: '', name: 'home' },
  { slug: 'faq', name: 'faq' },
  { slug: 'services/monolit', name: 'services_monolit' },
  { slug: 'contacts', name: 'contacts' },
  { slug: 'licenses', name: 'licenses' },
];
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 800 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 700 },
];
const SHOT_ROUTES = new Set(['home', 'faq', 'services_monolit', 'contacts', 'licenses']);

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const tag = `${route.name || 'home'}@${vp.width}`;
    const errs = [];
    const failed = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && !/definitely-not/.test(r.url())) failed.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(`${BASE}/${route.slug}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const a = await page.evaluate(() => {
      const norm2 = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const main = document.querySelector('main') || document.body;
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0;
      };

      // 1. visible standalone technical labels
      const TECH = new Set(['text', 'gallery', 'services', 'projects', 'certificates', 'richtext', 'processsteps', 'features', 'faq', 'cta']);
      const tech = [...main.querySelectorAll('h1,h2,h3,h4,p,span,div')]
        .filter((el) => el.children.length === 0 && TECH.has(norm2(el.textContent)) && isVisible(el))
        .map((el) => el.tagName + ':' + el.textContent.trim().slice(0, 30));

      // 2. immediately duplicated headings / paragraphs (normalized, adjacent in DOM order)
      const seq = [...main.querySelectorAll('h1,h2,h3,p')].filter(isVisible);
      let dupHead = 0; let dupPara = 0; const dupSamples = [];
      for (let i = 1; i < seq.length; i++) {
        const a2 = norm2(seq[i - 1].textContent); const b2 = norm2(seq[i].textContent);
        if (!a2 || a2 !== b2) continue;
        if (seq[i].tagName.startsWith('H')) { dupHead++; } else { dupPara++; }
        dupSamples.push(b2.slice(0, 50));
      }

      // 3. heading hierarchy — no skipped levels downward (h1→h3 without h2 is a skip)
      const headings = [...main.querySelectorAll('h1,h2,h3')].filter(isVisible).map((h) => +h.tagName[1]);
      let skips = 0;
      for (let i = 1; i < headings.length; i++) if (headings[i] - headings[i - 1] > 1) skips++;

      // 4. horizontal overflow
      const overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);

      // 5. readable body column — widest substantive paragraph (meta/footer
      // one-liners like "Источник ↗" are not prose and are excluded)
      const widths = [...main.querySelectorAll('p')]
        .filter((p) => isVisible(p) && p.textContent.trim().length >= 30)
        .map((p) => p.getBoundingClientRect().width);
      const maxPara = widths.length ? Math.max(...widths) : 0;

      // 6. broken media
      const brokenImgs = [...main.querySelectorAll('img')].filter((im) => isVisible(im) && im.complete && im.naturalWidth === 0).length;

      return {
        tech, dupHead, dupPara, dupSamples, skips,
        h1: main.querySelectorAll('h1').length,
        overflow: Math.round(overflow), maxPara: Math.round(maxPara),
        faqItems: main.querySelectorAll('.faq__item').length,
        faqQs: [...main.querySelectorAll('.faq__q')].filter((el) => norm2(el.textContent).length > 5).length,
        steps: main.querySelectorAll('.steps__item').length,
        feats: main.querySelectorAll('.feats__item').length,
        rich: main.querySelectorAll('.block.rich').length,
        certs: main.querySelectorAll('.certs__cell').length,
        brokenImgs,
      };
    });

    check(`${tag} tech-labels`, a.tech.length === 0, a.tech.join(';') || 'none');
    check(`${tag} dup-headings`, a.dupHead === 0, `${a.dupHead} ${a.dupSamples.join(';')}`);
    check(`${tag} dup-paragraphs`, a.dupPara === 0, `${a.dupPara} ${a.dupSamples.join(';')}`);
    check(`${tag} h1-count`, a.h1 === 1, `${a.h1}`);
    check(`${tag} heading-hierarchy`, a.skips === 0, `${a.skips} level skips`);
    check(`${tag} no-x-overflow`, a.overflow === 0, `${a.overflow}px`);
    check(`${tag} no-broken-media`, a.brokenImgs === 0, `${a.brokenImgs}`);
    check(`${tag} no-js-errors`, errs.length === 0, errs.join(';') || 'clean');
    check(`${tag} no-failed-req`, failed.length === 0, failed.slice(0, 2).join(';') || 'clean');
    if (vp.width >= 768) {
      check(`${tag} body-column≤820px`, a.maxPara <= 820, `${a.maxPara}px`);
    }

    if (route.name === 'faq' && vp.width === 1440) {
      check(`${tag} faq-items`, a.faqItems >= 8, `${a.faqItems} items`);
      check(`${tag} faq-questions`, a.faqQs >= 8, `${a.faqQs} questions`);
    }
    if (route.name === 'services_monolit' && vp.width === 1440) {
      check(`${tag} steps`, a.steps >= 4, `${a.steps}`);
      check(`${tag} feats`, a.feats >= 3, `${a.feats}`);
      check(`${tag} faq`, a.faqItems >= 3, `${a.faqItems}`);
    }
    if (route.name === 'licenses' && vp.width === 1440) {
      check(`${tag} certs`, a.certs === 6, `${a.certs}`);
    }

    if (SHOT_ROUTES.has(route.name) && (vp.width === 1440 || vp.width === 390)) {
      await mkdir(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `${route.name}-${vp.width}.png`), fullPage: true });
    }
    page.removeAllListeners('pageerror');
    page.removeAllListeners('response');
  }
  await ctx.close();
}

// FAQ accordion behaviour — desktop disclosure semantics.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/faq`, { waitUntil: 'networkidle' });
  const acc = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.faq__item')];
    const first = items[0];
    const q = first?.querySelector('summary');
    const a = first?.querySelector('.faq__a');
    const before = first?.hasAttribute('open');
    q?.click();
    const after = first?.hasAttribute('open');
    return { items: items.length, before, after, answerText: a?.textContent?.trim().length || 0 };
  });
  check('faq accordion items', acc.items >= 8, `${acc.items}`);
  check('faq accordion toggles', acc.after !== acc.before, `open ${acc.before}→${acc.after}`);
  check('faq answers present', acc.answerText > 20, `${acc.answerText} chars`);
  await ctx.close();
}

await browser.close();
const pass = results.filter((r) => r.ok).length;
await writeFile(path.join(OUT, 'playwright-results.json'), JSON.stringify({
  at: new Date().toISOString(), pass, total: results.length, viewports: VIEWPORTS.map((v) => v.width),
  routes: ROUTES.map((r) => r.slug || '/'), results,
}, null, 2));
console.log(`\n${pass}/${results.length} passed → ${OUT}/playwright-results.json`);
process.exit(pass === results.length ? 0 : 1);
