// Phase 2B-B: generate real CMS + Showcase for pilot sites from the REVIEWED
// SiteContentPlan V2. The plan is the contract: verifyPlanHash before import,
// persist the consumed hash, no semantic reclassification downstream.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { verifyPlanHashV2 } from '../packages/redesign-engine/dist/plan/siteContentPlanV2.js';
import { planToContent } from '../packages/redesign-engine/dist/plan/planToContent.js';
import { importToCms } from '../packages/redesign-engine/dist/import/importToCms.js';
import { validateGeneratedSite } from '../packages/redesign-engine/dist/pipeline/validateSite.js';

const PILOT = 'data/redesign/pilot-2b';
const SITES = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TARGETS = SITES.length ? SITES : ['lishen', 'puzzlehouse', 'sdke'];
const prisma = new PrismaClient();
const randToken = () => Math.random().toString(36).slice(2, 12);
const slugify = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const results = [];
for (const key of TARGETS) {
  const dir = path.join(PILOT, key);
  const planPath = path.join(dir, 'site-content-plan-v2.json');
  const crawlPath = path.join(dir, 'crawl-full.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const crawl = JSON.parse(fs.readFileSync(crawlPath, 'utf8'));
  console.log(`\n=== ${key} ===`);

  // Contract: the reviewed plan is consumed byte-for-byte.
  if (!verifyPlanHashV2(plan)) {
    console.log('  PLAN HASH MISMATCH — refusing to generate');
    results.push({ key, error: 'plan hash mismatch' });
    continue;
  }
  const reviewedPlanHash = plan.planHash;
  console.log(`  plan hash verified: ${reviewedPlanHash.slice(0, 16)}`);

  const domain = new URL(plan.baseUrl).hostname;
  const siteName = plan.siteIdentity.displayName || domain;

  // Normal WLA lifecycle: Lead → Site → Showcase.
  const lead = await prisma.lead.upsert({
    where: { source_sourceId: { source: 'manual', sourceId: `pilot-2b-${key}` } },
    update: { companyName: siteName, website: plan.baseUrl, websiteDomain: domain, manualReviewStatus: 'GOOD', phone: plan.contacts.phones[0]?.value, address: plan.contacts.addresses[0]?.value },
    create: {
      source: 'manual', sourceId: `pilot-2b-${key}`, companyName: siteName, city: 'Минск',
      website: plan.baseUrl, websiteDomain: domain, phone: plan.contacts.phones[0]?.value, address: plan.contacts.addresses[0]?.value,
      manualReviewStatus: 'GOOD', enrichmentStatus: 'SUCCESS', auditStatus: 'SUCCESS', scoreStatus: 'SUCCESS', generationStatus: 'SUCCESS',
      redesignStage: 'SELECTED_FOR_REDESIGN',
    },
  });

  const run = await prisma.redesignRun.create({
    data: { leadId: lead.id, stage: 'CRAWL_READY', crawlJsonPath: path.resolve(crawlPath) },
  });

  const content = planToContent(plan);
  fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify(content, null, 2));
  const previewSlug = randToken();
  const artifactDir = path.resolve(dir, 'gen');

  try {
    const { siteId, demoVariantId } = await importToCms({
      leadId: lead.id,
      lead: { id: lead.id, companyName: siteName, phone: lead.phone, address: lead.address },
      siteName, siteSlug: `${slugify(domain)}-${lead.id.slice(-5)}`, previewSlug,
      templateId: 'construction-modern-v1',
      content, artifactDir, storageBaseUrl: '/site-media',
      runId: run.id, regenerateContent: true,
    }, prisma);

    await prisma.site.update({ where: { id: siteId }, data: { domain, status: 'ACTIVE', settings: { previewUrl: `http://localhost:3336/showcase/${previewSlug}` } } });
    await prisma.siteBuild.create({ data: { siteId, demoVariantId, templateId: 'construction-modern-v1', status: 'SUCCESS', outputPath: `data/generated/sites/${siteId}` } });
    await prisma.redesignRun.update({ where: { id: run.id }, data: { siteId, stage: 'DEMO_GENERATED' } });
    await prisma.lead.update({ where: { id: lead.id }, data: { redesignStage: 'DEMO_GENERATED' } });

    const validation = await validateGeneratedSite({ siteId, prisma });
    const showcaseUrl = `http://localhost:3336/showcase/${previewSlug}`;
    console.log(`  siteId=${siteId} preview=${showcaseUrl} validation=${validation.ok ? 'OK' : 'FAIL: ' + validation.missing.join(',')}`);

    const counts = {
      pages: await prisma.page.count({ where: { siteId } }),
      services: await prisma.service.count({ where: { siteId } }),
      projects: await prisma.project.count({ where: { siteId } }),
      news: await prisma.newsPost.count({ where: { siteId } }),
      vacancies: await prisma.vacancy.count({ where: { siteId } }),
      media: await prisma.media.count({ where: { siteId } }),
      menuItems: await prisma.menuItem.count({ where: { siteId } }),
    };

    const review = [
      `# Generation review — ${key}`, '',
      `## Plan`, `- path: ${planPath}`, `- reviewedPlanHash: ${reviewedPlanHash}`, `- consumedPlanHash: ${reviewedPlanHash} (verified identical via verifyPlanHashV2)`,
      '', '## CMS', ...Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`),
      '', '## Homepage planned sections', ...plan.homepage.plannedSections.map((s) => `- ${s.type} — "${s.heading}" (${s.entityIds.length} entities)`),
      '', '## Navigation', ...plan.plannedNavigation.map((n) => `- ${n.label} → ${n.route}`),
      '', '## Entities', ...plan.entities.map((e) => `- [${e.type}] ${e.title}`),
      '', '## Dynamic sections', ...plan.dynamicSections.filter((d) => d.kind !== 'IGNORED').map((d) => `- ${d.kind} — ${d.heading || ''} (${d.items.length} items)`),
      '', '## Omitted / warnings', ...plan.omittedContent.slice(0, 20).map((o) => `- ${o.what} — ${o.reason}`), ...plan.warnings.map((w) => `- WARN ${w}`),
      '', '## Showcase', `- URL: ${showcaseUrl}`, `- siteId: ${siteId}`, `- validation: ${validation.ok ? 'PASS' : 'FAIL ' + validation.missing.join(', ')}`,
    ].join('\n') + '\n';
    fs.writeFileSync(path.join(dir, 'generation-review.md'), review);
    results.push({ key, siteId, previewSlug, showcaseUrl, counts, validation: validation.ok });
  } catch (e) {
    console.log(`  GENERATION FAILED: ${e.message}`);
    await prisma.redesignRun.update({ where: { id: run.id }, data: { errorMessage: e.message, stage: 'CRAWL_FAILED' } });
    results.push({ key, error: e.message });
  }
}

console.log('\n=== RESULTS ===');
for (const r of results) console.log(r.error ? `${r.key}: FAILED ${r.error}` : `${r.key}: ${r.showcaseUrl} | ${JSON.stringify(r.counts)} | valid=${r.validation}`);
await prisma.$disconnect();
