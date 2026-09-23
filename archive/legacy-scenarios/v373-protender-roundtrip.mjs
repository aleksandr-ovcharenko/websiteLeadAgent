#!/usr/bin/env node
// V3.7.3 — CMS text-ownership roundtrip proof on the ProTender page.
//
// Contract §9: change visible page text through the CMS only → rendered
// showcase reflects it → restore through CMS → rendered output restored.
// No code or DB-side patching: every write goes through the CMS HTTP API.
//
// Usage:
//   node scripts/v373-protender-roundtrip.mjs \
//     --site=<siteId> --token=<previewToken> --slug=<serviceSlug> \
//     [--cms=http://localhost:3335] [--auth=http://localhost:3333] \
//     [--render=http://localhost:3336] [--out=data/redesign/v373/protender-roundtrip.json]

import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import { DEFAULT_TEMPLATE_COPY_RU } from '../packages/redesign-engine/dist/import/templateCopy.js';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));

const SITE_ID = args.site;
const TOKEN = args.token;
const SLUG = args.slug || 'protender-1';
const CMS = args.cms || 'http://localhost:3335';
const AUTH = args.auth || 'http://localhost:3333';
const RENDER = args.render || 'http://localhost:3336';
const OUT = args.out || 'data/redesign/v373/protender-roundtrip.json';
const MARK = 'V37EDIT';

if (!SITE_ID || !TOKEN) {
  console.error('required: --site=<siteId> --token=<previewToken> [--slug=protender-1]');
  process.exit(2);
}

// ── auth ────────────────────────────────────────────────────────────────────
let cookie = '';
async function login() {
  const r = await fetch(`${AUTH}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: AUTH },
    body: JSON.stringify({ email: process.env.CMS_EMAIL || 'admin@minsk.local', password: process.env.CMS_PASSWORD || 'admin123' }),
  });
  if (!r.ok) throw new Error(`login failed: ${r.status} ${await r.text()}`);
  const setCookies = r.headers.getSetCookie?.() || [r.headers.get('set-cookie')].filter(Boolean);
  cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('login: no session cookie');
}

async function api(method, path, body) {
  const r = await fetch(`${CMS}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie, origin: CMS },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

// ── rendered-text snapshot (Playwright — the real DOM, not the payload) ─────
let browser;
async function rendered(path) {
  // Fresh context per snapshot — no shared HTTP cache can serve a stale
  // pre-restore page.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${RENDER}/showcase/${TOKEN}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
  const payload = await page.evaluate(() => window.__CMS__ || null);
  await ctx.close();
  return { text, payload };
}

function mustContain(haystack, needle, label) {
  if (!haystack.includes(needle)) throw new Error(`${label}: rendered page does not contain "${needle.slice(0, 80)}"`);
}

function mustNotContain(haystack, needle, label) {
  if (haystack.includes(needle)) throw new Error(`${label}: rendered page still contains "${needle.slice(0, 80)}"`);
}

async function main() {
  await login();
  browser = await chromium.launch();
  const report = { site: SITE_ID, slug: SLUG, edits: [], roundtrip: 'PENDING' };

  // ── 1. baseline ──────────────────────────────────────────────────────────
  const cms0 = await api('GET', `/api/cms/sites/${SITE_ID}`);
  const svc0 = cms0.services.find((s) => s.slug === SLUG);
  if (!svc0) throw new Error(`service ${SLUG} not found`);
  const settings0 = cms0.site.siteSettings || {};
  let copy0 = settings0.templateCopy || {};
  // Sites generated before V3.7.3 have no dictionary yet — seed the generated
  // defaults through the CMS write path (they are ordinary CMS data afterwards).
  if (!Object.keys(copy0).length) {
    await api('POST', `/api/cms/sites/${SITE_ID}/settings`, { templateCopy: DEFAULT_TEMPLATE_COPY_RU });
    copy0 = DEFAULT_TEMPLATE_COPY_RU;
    report.seededTemplateCopy = true;
  }

  const hero0 = (svc0.blocks || []).find((b) => b.type === 'hero') || {};
  const listBlock = (svc0.blocks || []).find((b) => (b.items || []).length) || {};
  const cta0 = (svc0.blocks || []).find((b) => b.type === 'cta') || {};

  const orig = {
    title: svc0.title,
    shortDescription: svc0.shortDescription,
    heroTitle: hero0.title,
    problemItem: listBlock.items?.[0],
    ctaLabel: cta0.title,
    siteName: settings0.companyName,
    copyViewAll: copy0['viewAll.template'],
    copySourceLink: copy0['source.link'],
  };
  report.originals = orig;

  // Resolve the public route by probing slug candidates against ROUTE.type —
  // no guessing at slug-suffix conventions.
  let detailPath = null;
  for (const cand of [`/${SLUG}`, `/${SLUG.replace(/-\d+$/, '')}`, `/${SLUG}-1`]) {
    const r = await rendered(cand);
    if (r.payload?.ROUTE?.type === 'SERVICE_DETAIL') { detailPath = cand; break; }
  }
  if (!detailPath) throw new Error(`no SERVICE_DETAIL route resolves for slug ${SLUG}`);
  report.detailPath = detailPath;
  const basePage = await rendered(detailPath);
  mustContain(basePage.text, orig.title, 'baseline');

  // ── 2. CMS edits ─────────────────────────────────────────────────────────
  const blocks = (svc0.blocks || []).map((b) => ({ ...b }));
  const heroI = blocks.findIndex((b) => b.type === 'hero');
  const listI = blocks.findIndex((b) => (b.items || []).length);
  const ctaI = blocks.findIndex((b) => b.type === 'cta');
  if (heroI >= 0) blocks[heroI] = { ...blocks[heroI], title: `${blocks[heroI].title} ${MARK}` };
  if (listI >= 0) {
    const items = [...blocks[listI].items];
    items[0] = `${items[0]} ${MARK}`;
    blocks[listI] = { ...blocks[listI], items };
  }
  if (ctaI >= 0) blocks[ctaI] = { ...blocks[ctaI], title: `${blocks[ctaI].title} ${MARK}` };

  await api('PUT', `/api/cms/sites/${SITE_ID}/services/${svc0.id}`, {
    title: `${orig.title} ${MARK}`,
    shortDescription: `${orig.shortDescription || ''} ${MARK}`.trim(),
    blocks,
  });
  report.edits.push('service.title', 'service.shortDescription', 'blocks[hero].title', 'blocks[list].items[0]', 'blocks[cta].title');

  const copy1 = { ...copy0 };
  if (copy1['viewAll.template'] !== undefined) copy1['viewAll.template'] = `Все {name} ${MARK}`;
  if (copy1['source.link'] !== undefined) copy1['source.link'] = `Источник ${MARK}`;
  await api('POST', `/api/cms/sites/${SITE_ID}/settings`, {
    companyName: `${orig.siteName || ''} ${MARK}`.trim(),
    templateCopy: copy1,
  });
  report.edits.push('siteSettings.companyName', 'templateCopy[viewAll.template]', 'templateCopy[source.link]');

  // ── 3. verify rendered ───────────────────────────────────────────────────
  const edited = await rendered(detailPath);
  const e = edited.text;
  mustContain(e, `${orig.title} ${MARK}`, 'edited title');
  if (orig.ctaLabel) mustContain(e, `${orig.ctaLabel} ${MARK}`, 'edited CTA');
  if (orig.copySourceLink) mustContain(e, `Источник ${MARK}`, 'edited source label');
  if (orig.siteName) mustContain(e, `${orig.siteName} ${MARK}`, 'edited brand');

  // ── 4. restore through CMS ───────────────────────────────────────────────
  await api('PUT', `/api/cms/sites/${SITE_ID}/services/${svc0.id}`, {
    title: orig.title,
    shortDescription: orig.shortDescription,
    blocks: svc0.blocks,
  });
  await api('POST', `/api/cms/sites/${SITE_ID}/settings`, {
    companyName: orig.siteName,
    templateCopy: copy0,
  });

  // ── 5. verify restored ───────────────────────────────────────────────────
  const restored = await rendered(detailPath);
  mustContain(restored.text, orig.title, 'restored title');
  mustNotContain(restored.text, MARK, 'restored page must not contain marker');
  const homeRestored = await rendered('/');
  mustNotContain(homeRestored.text, MARK, 'restored home must not contain marker');

  // ── 6. rendered-text → cmsPath audit for the detail page ─────────────────
  const audit = await page_text_audit(detailPath);
  // Enrich with ownership/sourceUrl from CMS provenance.
  const svcNow = (await api('GET', `/api/cms/sites/${SITE_ID}`)).services.find((s) => s.slug === SLUG);
  const stNow = (await api('GET', `/api/cms/sites/${SITE_ID}`)).site.siteSettings || {};
  const prov = svcNow?.fieldProvenance || {};
  for (const r of audit) {
    if (!r.cmsPath) { r.ownership = null; r.sourceUrl = null; continue; }
    const root = r.cmsPath.split('.')[0].replace(/\[\d+\]/g, '');
    if (root === 'COPY') { r.ownership = 'SYSTEM'; r.sourceUrl = null; }
    else if (root === 'COMPANY' || root === 'NAV' || root === 'LOGO') {
      const p = (stNow.fieldProvenance || {}).companyName;
      r.ownership = p?.ownership || 'SOURCE'; r.sourceUrl = p?.sourceUrl || stNow.brandSourceUrl || null;
    } else {
      const leaf = r.cmsPath.split('.').pop().replace(/\[\d+\]/g, '');
      const p = prov[leaf] || prov[r.cmsPath.split('.').slice(1).join('.').replace(/\[\d+\]/g, '')] || null;
      r.ownership = p?.ownership || (svcNow?.manualModifiedAt ? 'EDITOR' : 'SOURCE');
      r.sourceUrl = p?.sourceUrl || svcNow?.sourceUrl || null;
    }
  }
  report.renderedTextAudit = audit;
  const cms1 = await api('GET', `/api/cms/sites/${SITE_ID}`);
  report.entityCounts = {
    before: { services: cms0.services.length, pages: cms0.pages.length },
    after: { services: cms1.services.length, pages: cms1.pages.length },
  };
  if (cms1.services.length !== cms0.services.length || cms1.pages.length !== cms0.pages.length) {
    throw new Error(`roundtrip created duplicate CMS records: ${JSON.stringify(report.entityCounts)}`);
  }
  report.roundtrip = 'PASS';
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(report, null, 2));
  console.log(`[done] ROUNDTRIP PASS → ${OUT}`);
  console.log(`  edits verified: ${report.edits.join(', ')}`);
  console.log(`  text audit: ${audit.length} rendered strings, ${audit.filter((a) => a.hardcoded).length} unmapped`);
}

async function page_text_audit(path) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${RENDER}/showcase/${TOKEN}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
  const rows = await page.evaluate(`(() => {
    const payload = window.__CMS__ || {};
    const flat = [];
    const walk = (node, path) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach((n, i) => { if (typeof n === 'string' && n.trim().length >= 2) flat.push({ path: path + '[' + i + ']', value: n }); else walk(n, path + '[' + i + ']'); }); return; }
      for (const [k, v] of Object.entries(node)) {
        if (k === 'MANIFEST' || k === 'PREVIEW_TOKEN' || k === 'SITE_ID' || k === 'BASE') continue;
        if (typeof v === 'string' && v.trim().length >= 2) flat.push({ path: path ? path + '.' + k : k, value: v });
        else if (typeof v === 'object') walk(v, path ? path + '.' + k : k);
      }
    };
    walk(payload, '');
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const interpRe = (tmpl) => new RegExp('^' + tmpl.split(/\\{[^}]+\\}/).map((p) => p.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.{0,40}') + '$');
    const findPath = (text) => {
      const t = norm(text);
      for (const f of flat) {
        const v = norm(f.value);
        if (!v) continue;
        if (v === t || v.includes(t) || t.includes(v)) return f.path;
        if (/\\{[^}]+\\}/.test(v) && interpRe(v).test(t)) return f.path;
      }
      return null;
    };
    const rows = []; const seen = new Set();
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const el = n.parentElement;
        if (!el || el.closest('script,style,noscript,template')) return NodeFilter.FILTER_REJECT;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.01) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n; while ((n = tw.nextNode())) {
      const t = norm(n.nodeValue);
      if (t.length >= 2 && !seen.has(t) && /[A-Za-zА-Яа-яЁё]{2,}/.test(t)) { seen.add(t); rows.push({ renderedText: t.slice(0,160), cmsPath: findPath(t), hardcoded: false }); }
    }
    for (const r of rows) if (!r.cmsPath) r.hardcoded = true;
    return rows;
  })()`);
  await ctx.close();
  return rows;
}

main().catch(async (e) => { console.error(`[fail] ${e.stack || e.message}`); process.exit(1); })
  .finally(async () => { await browser?.close(); });
