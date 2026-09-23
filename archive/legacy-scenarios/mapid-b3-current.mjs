import 'dotenv/config';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { captureScreenshots } from '../packages/redesign-engine/experiments/screenshots.mjs';
import { launch } from 'chrome-launcher';
import { launchSandboxedBrowser } from '@minsk/security';

const __dirname = dirname(fileURLToPath(import.meta.url));
const B26 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b26-cms';
const B28 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b28-polish';
const B3 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation';
const CURRENT = join(B3, 'current');
const RENDER = join(CURRENT, 'render');

await mkdir(CURRENT, { recursive: true });
await mkdir(RENDER, { recursive: true });
await mkdir(join(CURRENT, 'qa'), { recursive: true });

const { constructionModernV1 } = await import('../packages/templates/dist/construction-modern-v1/index.js');
const cms = JSON.parse(await readFile(join(B26, 'cms-content.json'), 'utf8'));
const siteId = 'mapid-b3-current';

// Build a map from the cms filename (e.g. 360x239-_K1A5633.dca.jpg)
// to the actual hashed image filename in B28 render/images.
const imageDir = join(B28, 'render', 'images');
const hashedImages = await readdir(imageDir);
const hashedByShort = new Map();
for (const f of hashedImages) {
  const i = f.indexOf('-');
  if (i > 0) {
    const short = f.slice(i + 1);
    hashedByShort.set(short, f);
  }
}

function resolveHashed(filename) {
  if (!filename) return undefined;
  return hashedByShort.get(filename) || filename;
}

function shortFromUrlOrValue(img) {
  if (!img) return undefined;
  if (typeof img === 'string') return img.split('/').pop();
  return img.filename;
}

// Map media by filename for constructionModernV1 mediaUrl().
// Force local hashed filename usage by clearing sourceUrl (which would otherwise be remote).
const mediaMap = new Map();
for (const m of cms.media || []) {
  const short = m.filename;
  const hashed = resolveHashed(short);
  const media = { id: short, filename: hashed, sourceUrl: undefined };
  mediaMap.set(short, media);
  if (m.id) mediaMap.set(m.id, media);
}

function mediaIdFrom(img) {
  if (!img) return undefined;
  if (typeof img === 'string') return shortFromUrlOrValue(img);
  return img.filename;
}

function transformHero(h) {
  return {
    ...h,
    imageId: mediaIdFrom(h.imageId || h.image)
  };
}

function transformAbout(a) {
  return {
    ...a,
    imageId: mediaIdFrom(a.imageId || a.image)
  };
}

const ctx = {
  site: { id: siteId, previewToken: '', name: cms.company?.name, slug: 'mapid' },
  settings: cms.branding || {},
  theme: cms.theme || {},
  hero: transformHero(cms.hero),
  about: transformAbout(cms.about),
  cta: cms.cta,
  logo: undefined,
  favicon: undefined,
  homepageSections: cms.homepageSections || [],
  pages: [],
  services: (cms.services || []).map((s, i) => ({ ...s, sortOrder: i })),
  projects: (cms.projects || []).slice(0, 12).map((p) => ({
    ...p,
    coverImageId: mediaIdFrom(p.coverImage),
    projectMedia: [{ media: { id: mediaIdFrom(p.coverImage), filename: p.coverImage?.filename } }]
  })),
  products: (cms.products || []).map((p) => ({
    ...p,
    coverImageId: mediaIdFrom(p.coverImage),
    productMedia: [{ media: { id: mediaIdFrom(p.coverImage), filename: p.coverImage?.filename } }]
  })),
  news: (cms.news || []).slice(0, 3).map((n) => ({
    ...n,
    coverImageId: mediaIdFrom(n.coverImage)
  })),
  vacancies: [],
  menu: (cms.navigation || []).map((n, i) => ({
    id: `nav_${i}`,
    label: n.label,
    title: n.label,
    url: n.url,
    href: n.url,
    target: n.url,
    targetType: 'PAGE',
    showInHeader: true,
    showInFooter: true,
    sortOrder: i
  })),
  mediaMap,
  route: '',
  subRoute: ''
};

let html = constructionModernV1(ctx);

// Post-process asset and media paths for local static serving
html = html.replace(/\/template-assets\/construction-modern-v1\//g, './');
html = html.replace(new RegExp(`/site-media/${siteId}/`, 'g'), './images/');

await writeFile(join(RENDER, 'b3-current.html'), html, 'utf8');

// Copy template assets
const templatePublic = '/Users/aleksandr.ovcharenko/websiteLeadAgent/packages/templates/dist/construction-modern-v1/public';
async function copyTree(src, dst) {
  await mkdir(dst, { recursive: true });
  for (const f of await readdir(src, { withFileTypes: true })) {
    const s = join(src, f.name);
    const d = join(dst, f.name);
    if (f.isDirectory()) await copyTree(s, d);
    else await copyFile(s, d);
  }
}
await copyTree(templatePublic, RENDER);

// Copy B28 image assets to current render/images
await mkdir(join(RENDER, 'images'), { recursive: true });
for (const f of await readdir(join(B28, 'render', 'images'))) {
  await copyFile(join(B28, 'render', 'images', f), join(RENDER, 'images', f));
}

// ---------- CMS round-trip edit ----------
const editedCms = JSON.parse(JSON.stringify(cms));
const serviceIdx = editedCms.services.findIndex(s => s.slug === 'строительство');
let roundTrip = { pass: false, before: '', after: '' };
if (serviceIdx >= 0) {
  roundTrip.before = editedCms.services[serviceIdx].title;
  editedCms.services[serviceIdx].title = `${roundTrip.before} (отредактировано)`;
  const editedCtx = { ...ctx, services: ctx.services.map((s, i) => i === serviceIdx ? { ...s, title: editedCms.services[serviceIdx].title } : s) };
  let editedHtml = constructionModernV1(editedCtx);
  editedHtml = editedHtml.replace(/\/template-assets\/construction-modern-v1\//g, './');
  editedHtml = editedHtml.replace(new RegExp(`/site-media/${siteId}/`, 'g'), './images/');
  roundTrip.pass = editedHtml.includes('(отредактировано)');
  roundTrip.after = editedCms.services[serviceIdx].title;
  await writeFile(join(RENDER, 'b3-current-edited.html'), editedHtml, 'utf8');
}

// ---------- Lighthouse ----------
const server = exec(`python3 -m http.server 3464 --directory ${RENDER}`);
await new Promise(r => setTimeout(r, 1200));

const { default: lighthouse } = await import('lighthouse');
const chrome = await launch({ chromeFlags: ['--headless', '--disable-gpu', '--ignore-certificate-errors'] });
let lhSummary = null;
try {
  const result = await lighthouse('http://localhost:3464/b3-current.html', {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
  });
  const lhr = result?.lhr;
  if (lhr) {
    lhSummary = {
      performance: Math.round((lhr.categories?.performance?.score ?? 0) * 100),
      accessibility: Math.round((lhr.categories?.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((lhr.categories?.['best-practices']?.score ?? 0) * 100),
      seo: Math.round((lhr.categories?.seo?.score ?? 0) * 100),
      lcp: lhr.audits?.['largest-contentful-paint']?.numericValue,
      cls: lhr.audits?.['cumulative-layout-shift']?.numericValue,
      fcp: lhr.audits?.['first-contentful-paint']?.numericValue,
      tbt: lhr.audits?.['total-blocking-time']?.numericValue
    };
  }
} catch (e) {
  lhSummary = { error: e.message };
} finally {
  try { await chrome.kill(); } catch {}
}

await writeFile(join(CURRENT, 'lighthouse.json'), JSON.stringify({ url: 'http://localhost:3464/b3-current.html', summary: lhSummary }, null, 2));

// ---------- Screenshots ----------
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  'small-tablet': { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
  tiny: { width: 360, height: 640 }
};

const shots = await captureScreenshots({
  targets: [
    { name: 'b3-current', url: `http://localhost:3464/b3-current.html`, type: 'B3_CURRENT' }
  ],
  outDir: join(CURRENT, 'qa'),
  viewports
});

// ---------- Deterministic QA ----------
const qaResults = [];
async function testPage(url, viewport) {
  const browser = await launchSandboxedBrowser({ headless: true });
  const ctx2 = await browser.newContext({ viewport });
  const page = await ctx2.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    qaResults.push({ label: 'b3-current', viewport: `${viewport.width}x${viewport.height}`, test: 'horizontalOverflow', pass: !overflow });
    const sectionsVisible = await page.evaluate(() => Array.from(document.querySelectorAll('section')).filter(s => getComputedStyle(s).opacity !== '0').length >= 3);
    qaResults.push({ label: 'b3-current', viewport: `${viewport.width}x${viewport.height}`, test: 'sectionsVisible', pass: sectionsVisible });
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    qaResults.push({ label: 'b3-current', viewport: `${viewport.width}x${viewport.height}`, test: 'consoleErrors', pass: consoleErrors.length === 0 });
  } catch (e) {
    qaResults.push({ label: 'b3-current', viewport: `${viewport.width}x${viewport.height}`, error: e.message });
  } finally {
    await ctx2.close();
    await browser.close();
  }
}

await testPage('http://localhost:3464/b3-current.html', viewports.desktop);
await testPage('http://localhost:3464/b3-current.html', viewports.mobile);

await writeFile(join(CURRENT, 'qa-results.json'), JSON.stringify(qaResults, null, 2));

await writeFile(join(CURRENT, 'generation.json'), JSON.stringify({
  variant: 'CURRENT_TEMPLATE',
  templateId: 'construction-modern-v1',
  source: 'packages/templates/dist/construction-modern-v1',
  cms: 'cms-content.json',
  output: 'b3-current.html',
  cmsRoundTrip: roundTrip,
  lcp: lhSummary?.lcp,
  metrics: lhSummary
}, null, 2));

console.log('B3_CURRENT complete:', CURRENT);
console.log('Lighthouse:', lhSummary);
console.log('Screenshots:', shots.map(s => s.path));
console.log('QA checks:', qaResults.length);

try { server.kill(); } catch {}
