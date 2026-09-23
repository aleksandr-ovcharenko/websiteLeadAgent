#!/usr/bin/env node
// V3.7.4 Phase 9 — recover the existing NextTrade site IN PLACE.
//
// Site cmuctw9vr0004iejw4nd89vbt (preview 1dooxfp9). No new Site, Lead,
// DemoVariant or preview token is created. Steps:
//   1. normalize every CMS entity's blocks in place (dedupe sequences, drop
//      summary-duplicate first blocks, unglue titles/fragments) with a
//      provenance log per repair;
//   2. open the next SiteRevision on the site's existing variant, storing the
//      repaired content snapshot + hash + route manifest;
//   3. capture the mandatory screenshot set into RevisionScreenshot rows;
//   4. re-audit duplicates — promotion to REVIEW_READY only when zero
//      findings AND screenshots cover the manifest at both viewports.
//
// Usage: node scripts/v374-recover-nexttrade.mjs [--apply]

import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEntityContent, auditEntityDuplicates } = await import('../packages/redesign-engine/dist/qa/duplicateContent.js');
const { createPrismaRevisionStore } = await import('../packages/redesign-engine/dist/pipeline/revisions.js');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SITE_ID = 'cmuctw9vr0004iejw4nd89vbt';
const PREVIEW = '1dooxfp9';
const BASE = process.env.RENDER_BASE || 'http://localhost:3000';
const OUT = 'data/redesign/v374/nexttrade-recovery';
mkdirSync(`${OUT}/screenshots`, { recursive: true });

const site = await prisma.site.findUniqueOrThrow({ where: { id: SITE_ID }, include: { demoVariants: true } });
const variant = site.demoVariants.find(v => v.isPreferred) || site.demoVariants[0];
if (!variant) throw new Error('no demo variant on canonical site');

// Source crawl — stored HTML restores spacing the extractor flattened
// (e.g. H1 "Дизайн-проект<br>продуктового магазина").
const crawl = JSON.parse(readFileSync('data/redesign/v373/nexttrade/crawl.json', 'utf8'));
const sourceByUrl = new Map();
for (const pg of crawl.pages || []) {
  if (pg.url) sourceByUrl.set(pg.url, pg);
  if (pg.finalUrl) sourceByUrl.set(pg.finalUrl, pg);
}
function h1FromHtml(pg) {
  const m = String(pg?.html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}
const noSpaces = s => String(s || '').toLowerCase().replace(/\s+/g, '');

// ── 1. In-place content normalization ───────────────────────────────────────
const report = { siteId: SITE_ID, variantId: variant.id, applied: APPLY, entities: [] };
for (const model of ['service', 'project', 'product', 'newsPost', 'page']) {
  const rows = await prisma[model].findMany({ where: { siteId: SITE_ID } });
  for (const row of rows) {
    const summary = row.shortDescription || row.summary || row.excerpt;
    const srcPg = row.sourceUrl ? sourceByUrl.get(row.sourceUrl) : null;
    const { entity, repairs } = normalizeEntityContent({ ...row, summary, metaDescription: srcPg?.metaDescription });
    // Title restore from source H1 when it matches modulo whitespace —
    // provenance-grounded, no guessing at word boundaries.
    const srcH1 = h1FromHtml(srcPg);
    if (srcH1 && entity.title && noSpaces(srcH1) === noSpaces(entity.title) && srcH1 !== entity.title) {
      repairs.push({ blockId: `${model}:${row.slug}:title`, kind: 'glued-heading', detail: `title restored from source H1: "${srcH1}"`, removed: [entity.title] });
      entity.title = srcH1;
    }
    if (!repairs.length) continue;
    if (APPLY) {
      const data = { title: entity.title, blocks: entity.blocks };
      for (const f of ['excerpt', 'shortDescription', 'summary']) {
        if (row[f] !== undefined && entity[f] !== undefined && entity[f] !== row[f]) data[f] = entity[f];
      }
      await prisma[model].update({ where: { id: row.id }, data });
    }
    report.entities.push({ model, id: row.id, slug: row.slug, repairs });
  }
}

// ── 2. Revision + snapshot ──────────────────────────────────────────────────
const store = createPrismaRevisionStore(prisma);
let revision = null;
if (APPLY) {
  const runId = `v374-recovery-${Date.now()}`;
  const rr = await store.createOrResume({ siteId: SITE_ID, variantId: variant.id, runId, templateId: site.templateId, resume: false });
  revision = rr.revision;
  const [pg, sv, pr, pd, nw, vc] = await Promise.all([
    prisma.page.findMany({ where: { siteId: SITE_ID } }),
    prisma.service.findMany({ where: { siteId: SITE_ID } }),
    prisma.project.findMany({ where: { siteId: SITE_ID } }),
    prisma.product.findMany({ where: { siteId: SITE_ID } }),
    prisma.newsPost.findMany({ where: { siteId: SITE_ID } }),
    prisma.vacancy.findMany({ where: { siteId: SITE_ID } }),
  ]);
  const snapshot = { pages: pg, services: sv, projects: pr, products: pd, news: nw, vacancies: vc };
  const contentHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 16);
  // Route manifest: home + every published detail route + collections present.
  const routes = ['/'];
  const collections = new Set();
  const addEntityRoutes = (list, coll) => {
    let added = 0;
    for (const e of list) if (e.status === 'PUBLISHED' && e.slug) { routes.push(`/${e.slug}`); added++; }
    if (added) collections.add(coll);
  };
  addEntityRoutes(sv, 'services'); addEntityRoutes(pr, 'projects'); addEntityRoutes(pd, 'products');
  addEntityRoutes(nw, 'news'); addEntityRoutes(vc, 'vacancies');
  await prisma.siteRevision.update({ where: { id: revision.id }, data: { contentSnapshot: snapshot, contentHash, routeManifest: routes } });
  report.revision = { id: revision.id, version: revision.version, routes: routes.length };
}

// ── 3. Mandatory screenshots → RevisionScreenshot rows ──────────────────────
if (APPLY && revision) {
  const { chromium } = await import('playwright').catch(() => import('playwright-core'));
  const browser = await chromium.launch();
  try {
    const routes = report.revision ? (await prisma.siteRevision.findUnique({ where: { id: revision.id }, select: { routeManifest: true } })).routeManifest : ['/'];
    for (const route of routes) {
      for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage();
        const resp = await page.goto(`${BASE}/showcase/${PREVIEW}${route === '/' ? '' : route}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
        if (!resp || !resp.ok()) { console.log(`  shot skip ${route}@${w}x${h}: ${resp?.status()}`); await ctx.close(); continue; }
        const path = `${OUT}/screenshots/${route.replace(/\//g, '_') || 'home'}-${tag}.png`;
        await page.screenshot({ path });
        await store.addScreenshot(revision.id, { route, viewport: `${w}x${h}`, storagePath: path });
        await ctx.close();
      }
    }
    // mobile menu open
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/showcase/${PREVIEW}/`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
    const burger = await page.$('button[aria-label*="menu" i], [class*="burger"], [class*="menu-toggle"], header button');
    if (burger) {
      await burger.click().catch(() => null);
      await page.waitForTimeout(400);
      const path = `${OUT}/screenshots/home-mobile-menu-open.png`;
      await page.screenshot({ path });
      await store.addScreenshot(revision.id, { route: '/', viewport: '390x844', storagePath: path });
    }
    await ctx.close();
  } finally { await browser.close(); }
}

// ── 4. Re-audit + promote ───────────────────────────────────────────────────
const after = {};
let totalFindings = 0;
for (const model of ['service', 'project', 'product', 'newsPost', 'page']) {
  const rows = await prisma[model].findMany({ where: { siteId: SITE_ID } });
  for (const row of rows) {
    // In dry-run, audit the projected (normalized) state, not the raw row.
    const srcPg = row.sourceUrl ? sourceByUrl.get(row.sourceUrl) : null;
    const target = APPLY ? { ...row, summary: row.shortDescription || row.summary || row.excerpt }
      : normalizeEntityContent({ ...row, summary: row.shortDescription || row.summary || row.excerpt, metaDescription: srcPg?.metaDescription }).entity;
    const findings = auditEntityDuplicates(target);
    if (findings.length) { after[`${model}:${row.slug}`] = findings; totalFindings += findings.length; }
  }
}
report.postAudit = { findings: totalFindings, details: after };

if (APPLY && revision) {
  const routes = (await prisma.siteRevision.findUnique({ where: { id: revision.id }, select: { routeManifest: true } })).routeManifest;
  if (totalFindings === 0) {
    try {
      const promoted = await store.promote(revision.id, 'REVIEW_READY', routes);
      report.promotion = { status: promoted.status, revisionId: revision.id };
      await prisma.demoVariant.update({ where: { id: variant.id }, data: { activeRevisionId: revision.id } });
    } catch (e) {
      report.promotion = { status: 'QA_FAILED', error: e.message };
      await store.fail(revision.id, e.message);
    }
  } else {
    await store.fail(revision.id, `${totalFindings} duplicate findings remain`);
    report.promotion = { status: 'QA_FAILED', error: `${totalFindings} findings` };
  }
}

writeFileSync(`${OUT}/recovery-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ applied: APPLY, entitiesRepaired: report.entities.length, postFindings: totalFindings, promotion: report.promotion || 'dry-run' }, null, 2));
await prisma.$disconnect();
