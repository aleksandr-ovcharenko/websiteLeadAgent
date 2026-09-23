// V3.7 Phase 8 — rebuild SourceDocuments + SourceContentGraph for NextTrade
// from the existing crawl artifact (no re-crawl). semanticOnly: stops before
// CMS import so the graph can be inspected first.
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
  semanticOnly: true,
  force: true,
  prisma,
  onActivity: (e) => console.log(`[${e.level}] ${e.eventType} ${e.message}`),
});

console.log('sourceDocuments:', result.sourceDocumentsJsonPath);
console.log('sourceContentGraph:', result.sourceContentGraphPath);

// Copy artifacts into the V3.7 evidence dir + write an extraction report.
await mkdir(OUT, { recursive: true });
await copyFile(result.sourceDocumentsJsonPath, path.join(OUT, 'source-documents.json'));
await copyFile(result.sourceContentGraphPath, path.join(OUT, 'source-content-graph.json'));

const docs = JSON.parse(await import('node:fs/promises').then((m) => m.readFile(result.sourceDocumentsJsonPath, 'utf8')));
const graph = JSON.parse(await import('node:fs/promises').then((m) => m.readFile(result.sourceContentGraphPath, 'utf8')));

let tot = { sections: 0, collections: 0, images: 0, faqs: 0, respDupes: 0, repeated: 0, droppedEmpty: 0, droppedMedia: 0, droppedClones: 0, droppedArtboards: 0, dedupedParas: 0 };
const uniqSrcs = new Set();
for (const d of docs) {
  const dg = d.diagnostics || {};
  tot.sections += d.sections.length;
  tot.collections += d.collections.length;
  tot.images += d.images.length;
  d.images.forEach((i) => uniqSrcs.add(i.src));
  tot.faqs += d.sections.reduce((n, s) => n + s.faqs.length, 0);
  tot.respDupes += (dg.responsiveDuplicates || []).length;
  tot.repeated += (dg.repeatedContent || []).length;
  tot.droppedEmpty += dg.droppedEmptySections || 0;
  tot.droppedMedia += dg.droppedMedia || 0;
  tot.droppedClones += dg.droppedClones || 0;
  tot.droppedArtboards += dg.droppedArtboards || 0;
  tot.dedupedParas += (dg.dedupedParagraphs || []).length;
}

const report = {
  generatedAt: new Date().toISOString(),
  crawlRunId: CRAWL_RUN_ID,
  documents: docs.length,
  ...tot,
  uniqueImageSrcs: uniqSrcs.size,
  graph: {
    pages: graph.pages?.length ?? 0,
    services: graph.services?.length ?? 0,
    projects: graph.projects?.length ?? 0,
    news: graph.news?.length ?? 0,
    products: graph.products?.length ?? 0,
    warnings: graph.warnings?.length ?? 0,
  },
};
await writeFile(path.join(OUT, 'extraction-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await prisma.$disconnect();
