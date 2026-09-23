// V3.7 Phase 10 — canonical CMS import for 100m3: crawl artifact →
// SourceDocuments → SourceContentGraph → graphToImportContent → CMS.
// Idempotent: reuses the crawl run; the pipeline preserves Site.id on regen.
import { generateSite } from '../packages/redesign-engine/dist/index.js';
import { PrismaClient } from '@prisma/client';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/redesign/v37/100m3');
const LEAD_ID = 'cmtnjmlp3003799lgspbmjlm2';
const CRAWL_RUN_ID = 'cmubrzv0p000111omy4v62zab';

const prisma = new PrismaClient();

const result = await generateSite({
  leadId: LEAD_ID,
  crawlRunId: CRAWL_RUN_ID,
  templateId: 'editorial-architecture-v1',
  force: true,
  mode: 'regenerate',
  prisma,
  onActivity: (e) => console.log(`[${e.level}] ${e.eventType} ${e.message}`),
});

console.log('result:', JSON.stringify(result, null, 2).slice(0, 2000));

const lead = await prisma.lead.findUnique({ where: { id: LEAD_ID }, include: { site: true } });
console.log('site:', lead.site?.id, '| slug:', lead.site?.slug, '| preview:', lead.site?.previewToken, '| status:', lead.site?.status);

// Copy the import contract artifacts into the evidence dir.
await mkdir(OUT, { recursive: true });
const run = await prisma.redesignRun.findUnique({ where: { id: result.runId } });
if (run?.contentJsonPath) await copyFile(run.contentJsonPath, path.join(OUT, 'import-content.json'));
const provSrc = path.join(path.dirname(run?.crawlJsonPath || ''), 'graph-import-provenance.json');
try { await copyFile(provSrc, path.join(OUT, 'graph-import-provenance.json')); } catch {}

const [pages, media, services, projects, news, products, vacancies, menus] = await Promise.all([
  prisma.page.count({ where: { siteId: lead.site.id } }),
  prisma.media.count({ where: { siteId: lead.site.id } }),
  prisma.service.count({ where: { siteId: lead.site.id } }),
  prisma.project.count({ where: { siteId: lead.site.id } }),
  prisma.newsPost.count({ where: { siteId: lead.site.id } }),
  prisma.product.count({ where: { siteId: lead.site.id } }),
  prisma.vacancy.count({ where: { siteId: lead.site.id } }),
  prisma.menu.count({ where: { siteId: lead.site.id } }),
]);
const importReport = {
  generatedAt: new Date().toISOString(),
  siteId: lead.site.id,
  siteSlug: lead.site.slug,
  previewToken: lead.site.previewToken,
  runId: result.runId,
  cmsPages: pages,
  cmsMedia: media,
  entitiesByType: { services, projects, news, products, vacancies },
  menus,
};
await writeFile(path.join(OUT, 'cms-import-report.json'), JSON.stringify(importReport, null, 2));
console.log(JSON.stringify(importReport, null, 2));

await prisma.$disconnect();
