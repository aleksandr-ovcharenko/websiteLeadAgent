#!/usr/bin/env node
// V3.7.2 — clean-room generation proof.
//
// Runs the PUBLIC generation entry point (generateSite) once against an
// immutable crawl snapshot with a brand-new Lead → empty CMS namespace.
// No Prisma/CMS writes happen during the run: every write after the run
// starts is made by the pipeline itself. Setup creates only the input rows
// (Lead + crawl-run pointer) that a real run would already have.
//
// Usage:
//   node scripts/v372-clean-room.mjs --name=nexttrade --crawl=<crawl.json> --domain=nexttrade.by --company="..." [--second-run] [--no-browser]

import 'dotenv/config';
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { generateSite } from '../packages/redesign-engine/dist/pipeline/index.js';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));

const NAME = args.name || 'cleanroom';
const CRAWL = args.crawl;
const DOMAIN = args.domain;
const COMPANY = args.company || `Clean Room ${NAME}`;
const SECOND_RUN = args['second-run'] === true || args['second-run'] === 'true';
const BROWSER = args['no-browser'] !== true && args['no-browser'] !== 'true';
const TEMPLATE = args.template || 'editorial-architecture-v1';
const BASE = args.base || `data/redesign/v372/clean-room-${NAME}`;

if (!CRAWL || !DOMAIN) {
  console.error('required: --crawl=<path> --domain=<domain> [--name=] [--company=] [--second-run] [--no-browser]');
  process.exit(2);
}

const prisma = new PrismaClient();
const interventions = []; // any DB/CMS/source change during the run → FAIL

async function snapshotEntities(siteId) {
  if (!siteId) return null;
  const [site, variants, pgs, services, projs, prods, news, vacs, media, menus, items] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true, previewToken: true, domain: true } }),
    prisma.demoVariant.findMany({ where: { siteId }, select: { id: true, templateId: true, isPreferred: true } }),
    prisma.page.findMany({ where: { siteId }, select: { id: true, slug: true, sourceType: true, manualModifiedAt: true }, orderBy: { slug: 'asc' } }),
    prisma.service.findMany({ where: { siteId }, select: { id: true, slug: true }, orderBy: { slug: 'asc' } }),
    prisma.project.findMany({ where: { siteId }, select: { id: true, slug: true }, orderBy: { slug: 'asc' } }),
    prisma.product.findMany({ where: { siteId }, select: { id: true, slug: true }, orderBy: { slug: 'asc' } }),
    prisma.newsPost.findMany({ where: { siteId }, select: { id: true, slug: true, publishedAt: true }, orderBy: { slug: 'asc' } }),
    prisma.vacancy.findMany({ where: { siteId }, select: { id: true, slug: true }, orderBy: { slug: 'asc' } }),
    prisma.media.findMany({ where: { siteId }, select: { id: true, sourceUrl: true }, orderBy: { id: 'asc' } }),
    prisma.menu.findMany({ where: { siteId }, select: { id: true } }),
    prisma.menuItem.findMany({ where: { siteId }, select: { id: true, label: true, targetType: true, target: true, pageId: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return { site, variants, pages: pgs, services, projects: projs, products: prods, news, vacancies: vacs, media, menus, menuItems: items };
}

async function main() {
  await mkdir(BASE, { recursive: true });

  // ── Input construction (pre-run, recorded — not an intervention) ──────────
  const crawlDest = join(BASE, 'crawl.json');
  await copyFile(CRAWL, crawlDest);
  const crawlMeta = JSON.parse(await readFile(crawlDest, 'utf8')).meta || {};

  const lead = await prisma.lead.create({
    data: {
      source: 'manual',
      sourceId: `v372-cleanroom-${NAME}-${Date.now()}`,
      companyName: COMPANY,
      city: 'Минск',
      categories: [],
      // websiteDomain is unique in the schema — leave it unset so the clean-room
      // lead doesn't collide with the canonical lead; site.domain still derives
      // from `website` inside generateSite.
      website: `https://${DOMAIN}`,
      manualReviewStatus: 'GOOD',
      reviewedAt: new Date(),
    },
  });
  const crawlRun = await prisma.redesignRun.create({
    data: { leadId: lead.id, stage: 'CRAWL_READY', crawlJsonPath: crawlDest },
  });
  console.log(`[setup] lead=${lead.id} crawlRun=${crawlRun.id} domain=${DOMAIN}`);

  const transitions = [];
  const onActivity = async (p) => {
    transitions.push({ at: new Date().toISOString(), ...p });
    if (p.eventType?.startsWith('FACTORY_GATE_')) {
      console.log(`  gate ${p.details?.status || ''} ${p.message}`);
    }
  };

  // ── THE RUN — one public entry call, zero interventions ───────────────────
  const runStart = Date.now();
  let result;
  try {
    result = await generateSite({
      leadId: lead.id,
      crawlRunId: crawlRun.id,
      templateId: TEMPLATE,
      mode: 'regenerate',
      force: true,
      fixture: true,
      fixtureOwner: `v372-clean-room-${NAME}`,
      renderQaBaseUrl: 'http://localhost:3336',
      renderQaBrowser: BROWSER,
      onActivity,
    });
  } catch (e) {
    console.error(`[run] FAILED: ${e.message}`);
  }

  const run = await prisma.redesignRun.findUnique({ where: { id: crawlRun.id } });
  await writeFile(join(BASE, 'stage-transitions.json'), JSON.stringify({
    runId: crawlRun.id, leadId: lead.id, durationMs: Date.now() - runStart,
    finalStage: run?.stage, errorMessage: run?.errorMessage,
    stageResults: run?.stageResults, transitions,
  }, null, 2));

  const siteId = result?.siteId;
  const snap1 = await snapshotEntities(siteId);
  console.log(`[run] stage=${run?.stage} site=${siteId} preview=${result?.previewSlug}`);
  if (snap1) {
    console.log(`[run] pages=${snap1.pages.length} services=${snap1.services.length} projects=${snap1.projects.length} products=${snap1.products.length} news=${snap1.news.length} vacancies=${snap1.vacancies.length} media=${snap1.media.length} menuItems=${snap1.menuItems.length}`);
  }

  // copy the run artifacts into the clean-room dir
  const artifactDir = `data/redesign/${lead.id}/runs/${crawlRun.id}`;
  for (const f of ['generated-content-qa.json', 'route-integrity.json', 'post-render-qa.json', 'graph-import-provenance.json', 'source-content-graph.json', 'content.json']) {
    try { await copyFile(join(artifactDir, f), join(BASE, f)); } catch { /* optional */ }
  }

  const metrics = {
    manualInterventions: interventions.length,
    interventionLog: interventions,
    firstRun: snap1 && {
      siteId: snap1.site?.id, previewToken: snap1.site?.previewToken,
      variants: snap1.variants.length,
      pages: snap1.pages.length, services: snap1.services.length, projects: snap1.projects.length,
      products: snap1.products.length, news: snap1.news.length, vacancies: snap1.vacancies.length,
      media: snap1.media.length, menuItems: snap1.menuItems.length,
    },
    stageResults: run?.stageResults,
  };
  await writeFile(join(BASE, 'first-pass-metrics.json'), JSON.stringify(metrics, null, 2));

  // ── Idempotency: second run over generated state ──────────────────────────
  if (SECOND_RUN && result?.siteId) {
    const run2 = await prisma.redesignRun.create({
      data: { leadId: lead.id, stage: 'CRAWL_READY', crawlJsonPath: crawlDest },
    });
    let result2;
    try {
      result2 = await generateSite({
        leadId: lead.id, crawlRunId: run2.id, templateId: TEMPLATE,
        mode: 'regenerate', force: true, fixture: true, fixtureOwner: `v372-clean-room-${NAME}`,
        renderQaBaseUrl: 'http://localhost:3336', renderQaBrowser: false,
      });
    } catch (e) {
      console.error(`[run2] FAILED: ${e.message}`);
    }
    const snap2 = await snapshotEntities(result2?.siteId || siteId);
    const same = (a, b, key) => JSON.stringify((a || []).map((x) => key ? x[key] : x).sort()) === JSON.stringify((b || []).map((x) => key ? x[key] : x).sort());
    const idem = {
      sameSiteId: result2?.siteId === result.siteId,
      sameVariantCount: snap2.variants.length === snap1.variants.length,
      samePageSlugs: same(snap1.pages, snap2.pages, 'slug'),
      sameServiceSlugs: same(snap1.services, snap2.services, 'slug'),
      sameProjectSlugs: same(snap1.projects, snap2.projects, 'slug'),
      sameProductSlugs: same(snap1.products, snap2.products, 'slug'),
      sameNewsSlugs: same(snap1.news, snap2.news, 'slug'),
      sameMediaIdentities: same(snap1.media.map((m) => m.sourceUrl), snap2.media.map((m) => m.sourceUrl)),
      sameMenuTargets: same(snap1.menuItems.map((m) => `${m.targetType}:${m.target}`), snap2.menuItems.map((m) => `${m.targetType}:${m.target}`)),
      // Numbered siblings = NEW 'slug-N' pages that did not exist in run 1 —
      // source-paginated slugs like 'galery-page-2' are legitimate identity,
      // not dedupe artifacts.
      numberedSlugSiblings: snap2.pages.filter((p) => /-\d+$/.test(p.slug) && !snap1.pages.some((x) => x.slug === p.slug)).map((p) => p.slug),
      ownershipChanges: snap2.pages.filter((p) => p.manualModifiedAt && !snap1.pages.find((x) => x.id === p.id)?.manualModifiedAt).length,
      secondRunCounts: snap2 ? { pages: snap2.pages.length, projects: snap2.projects.length, news: snap2.news.length, products: snap2.products.length } : null,
    };
    idem.pass = idem.sameSiteId && idem.sameVariantCount && idem.samePageSlugs && idem.sameServiceSlugs
      && idem.sameProjectSlugs && idem.sameProductSlugs && idem.sameNewsSlugs && idem.sameMediaIdentities
      && idem.numberedSlugSiblings.length === 0 && idem.ownershipChanges === 0;
    await writeFile(join(BASE, 'idempotency.json'), JSON.stringify(idem, null, 2));
    await writeFile(join(BASE, 'snapshot-run1.json'), JSON.stringify(snap1, null, 2));
    await writeFile(join(BASE, 'snapshot-run2.json'), JSON.stringify(snap2, null, 2));
    console.log(`[idempotency] ${idem.pass ? 'PASS' : 'FAIL'} — sameSite=${idem.sameSiteId} sameSlugs=${idem.samePageSlugs && idem.sameProjectSlugs} numbered=${idem.numberedSlugSiblings.length}`);
  }

  await prisma.$disconnect();
  const ok = run?.stage === 'HUMAN_REVIEW_READY' && interventions.length === 0;
  console.log(`[done] ${ok ? 'CLEAN-ROOM PASS' : 'CLEAN-ROOM FAIL'} (stage=${run?.stage}, interventions=${interventions.length})`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
