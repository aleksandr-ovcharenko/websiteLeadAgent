import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { extractFromCrawl } from '../packages/redesign-engine/dist/extract/extractFromCrawl.js';
import { buildSourceDocuments } from '../packages/redesign-engine/dist/extract/buildSourceDocuments.js';
import { buildSourceContentGraph } from '../packages/redesign-engine/dist/semantic/graph.js';
import { buildSiteContentPlanV2 } from '../packages/redesign-engine/dist/plan/siteContentPlanV2.js';
import { planToContent } from '../packages/redesign-engine/dist/plan/planToContent.js';
import { importToCms } from '../packages/redesign-engine/dist/import/importToCms.js';

const prisma = new PrismaClient();
const CRAWL_PATH = 'data/redesign/mapid/crawl.json';
const BASE_ARTIFACT_DIR = 'data/experiments/mapid';

function token() {
  return randomBytes(4).toString('hex');
}

async function getOrCreateLead({ sourceId, name }) {
  const existing = await prisma.lead.findFirst({
    where: { source: 'manual', sourceId },
  });
  if (existing) return existing;
  return prisma.lead.create({
    data: {
      source: 'manual',
      sourceId,
      companyName: name,
      city: 'Минск',
      website: 'https://mapid.by/',
      websiteDomain: 'mapid.by',
      websiteStatus: 'FOUND',
      auditStatus: 'SUCCESS',
      manualReviewStatus: 'GOOD',
      redesignStage: 'DEMO_GENERATED',
      categories: ['construction', 'real-estate'],
    },
  });
}

async function main() {
  await mkdir(BASE_ARTIFACT_DIR, { recursive: true });

  const rawCrawl = JSON.parse(await readFile(CRAWL_PATH, 'utf8'));
  const crawlResult = rawCrawl.crawlResult;
  const baseUrl = crawlResult.homepage.url;
  const runId = rawCrawl.meta?.runId || `mapid-benchmark-${Date.now()}`;

  // Preserve shared source snapshot
  await writeFile(join(BASE_ARTIFACT_DIR, 'crawl.json'), JSON.stringify(rawCrawl, null, 2));

  // -------------------------------------------------------------------------
  // V1 baseline: deterministic legacy extraction
  // -------------------------------------------------------------------------
  const v1Content = extractFromCrawl(crawlResult.pages, baseUrl, crawlResult.navigation);
  const v1Lead = await getOrCreateLead({ sourceId: `mapid-v1-benchmark`, name: v1Content.company?.name || 'МАПИД' });
  const v1ArtifactDir = join(BASE_ARTIFACT_DIR, 'v1');
  await mkdir(v1ArtifactDir, { recursive: true });

  const v1Import = await importToCms({
    leadId: v1Lead.id,
    lead: { id: v1Lead.id, companyName: v1Content.company?.name || 'МАПИД', phone: v1Content.contacts?.phone, address: v1Content.contacts?.address },
    siteName: 'МАПИД V1 Baseline',
    siteSlug: `mapid-v1-${token()}`,
    previewSlug: `mapid-v1-${token()}`,
    templateId: 'construction-modern-v1',
    content: v1Content,
    artifactDir: v1ArtifactDir,
    storageBaseUrl: '/redesign-media',
    runId: `${runId}-v1`,
    regenerateContent: true,
  }, prisma);

  await prisma.site.update({
    where: { id: v1Import.siteId },
    data: { status: 'ACTIVE', domain: 'mapid.by' },
  });

  await writeFile(join(v1ArtifactDir, 'content.json'), JSON.stringify(v1Content, null, 2));

  // -------------------------------------------------------------------------
  // V2: source documents -> semantic graph -> content plan -> content
  // -------------------------------------------------------------------------
  const sourceDocuments = buildSourceDocuments(crawlResult);
  const v2ArtifactDir = join(BASE_ARTIFACT_DIR, 'v2');
  await mkdir(v2ArtifactDir, { recursive: true });
  await writeFile(join(v2ArtifactDir, 'source-documents.json'), JSON.stringify(sourceDocuments, null, 2));

  const graph = await buildSourceContentGraph({ sourceDocuments, baseUrl, runId: `${runId}-v2` });
  await writeFile(join(v2ArtifactDir, 'source-content-graph.json'), JSON.stringify(graph, null, 2));

  const graphHash = createHash('sha256').update(JSON.stringify(graph)).digest('hex').slice(0, 16);
  const plan = buildSiteContentPlanV2({
    graph,
    documents: sourceDocuments,
    baseUrl,
    siteKey: 'mapid-v2',
    sourceGraphHash: graphHash,
  });
  await writeFile(join(v2ArtifactDir, 'site-content-plan.json'), JSON.stringify(plan, null, 2));

  const v2Content = planToContent(plan);
  // Design direction: Architectural Editorial (selected after brief/directions)
  v2Content.theme = v2Content.theme || {};
  v2Content.theme.stylePreset = 'foret';
  v2Content.theme.primaryColor = '#c8742c';
  v2Content.theme.backgroundColor = '#f4f1e8';
  v2Content.theme.textColor = '#161d18';
  v2Content.theme.surfaceColor = '#ece7d8';

  const v2Lead = await getOrCreateLead({ sourceId: `mapid-v2-benchmark`, name: plan.siteIdentity?.displayName || 'МАПИД' });
  const v2Import = await importToCms({
    leadId: v2Lead.id,
    lead: { id: v2Lead.id, companyName: plan.siteIdentity?.displayName || 'МАПИД', phone: plan.contacts?.phones?.[0]?.value, address: plan.contacts?.addresses?.[0]?.value },
    siteName: 'МАПИД V2 Experimental',
    siteSlug: `mapid-v2-${token()}`,
    previewSlug: `mapid-v2-${token()}`,
    templateId: 'construction-modern-v1',
    content: v2Content,
    artifactDir: v2ArtifactDir,
    storageBaseUrl: '/redesign-media',
    runId: `${runId}-v2`,
    regenerateContent: true,
  }, prisma);

  await prisma.site.update({
    where: { id: v2Import.siteId },
    data: { status: 'ACTIVE', domain: 'mapid.by' },
  });

  await writeFile(join(v2ArtifactDir, 'content.json'), JSON.stringify(v2Content, null, 2));

  // -------------------------------------------------------------------------
  // Persist benchmark manifest
  // -------------------------------------------------------------------------
  const manifest = {
    source: { crawlPath: CRAWL_PATH, baseUrl, runId, crawledAt: rawCrawl.meta?.startedAt || new Date().toISOString(), pages: crawlResult.pages.length },
    v1: { leadId: v1Lead.id, siteId: v1Import.siteId, previewToken: v1Import.previewSlug, siteSlug: v1Import.siteSlug, artifactDir: v1ArtifactDir },
    v2: { leadId: v2Lead.id, siteId: v2Import.siteId, previewToken: v2Import.previewSlug, siteSlug: v2Import.siteSlug, artifactDir: v2ArtifactDir },
  };
  await writeFile(join(BASE_ARTIFACT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
