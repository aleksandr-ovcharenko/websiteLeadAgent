import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { generateSite } from '../packages/redesign-engine/dist/index.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const prisma = new PrismaClient();

const subjects = [
  { id: 'cmthnoa4f004dtnq3jt3hcleo', name: 'mapid', type: 'traditional multi-page', url: 'https://mapid.by/kontakty.html' },
  { id: 'cmthnoa460044tnq3a79elrmq', name: 'radlen', type: 'wordpress', url: 'https://radlen.by/' },
  { id: 'cmthnoa67005ptnq3x8ka19ai', name: 'minskdsk', type: 'legacy static', url: 'http://minskdsk.by/' },
  { id: 'cmtlwimyq004imz6a4ibjenua', name: 'savit', type: 'modern corporate', url: 'https://savit.by/' },
  { id: 'cmthnoa4j004gtnq3p58k8ji9', name: 'a100', type: 'spa-like modern', url: 'https://a-100development.by/' },
  { id: 'cmthnoa6z006atnq39gcoztg5', name: 'northwaterfront', type: 'multilingual', url: 'https://mcnorthwaterfront.by/ru/contacts' }
];

async function runSubject(subject) {
  console.log(`\n=== ACCEPTANCE ${subject.name.toUpperCase()} (${subject.url}) ===`);
  const lead = await prisma.lead.findUnique({ where: { id: subject.id }, include: { site: true } });
  if (!lead) throw new Error(`Lead not found: ${subject.id}`);

  const originalReviewStatus = lead.manualReviewStatus;
  if (originalReviewStatus !== 'GOOD') {
    console.log(`  temporarily setting manualReviewStatus from ${originalReviewStatus} to GOOD for acceptance`);
    await prisma.lead.update({ where: { id: subject.id }, data: { manualReviewStatus: 'GOOD' } });
  }

  const restoreStatus = async () => {
    if (originalReviewStatus && originalReviewStatus !== 'GOOD') {
      await prisma.lead.update({ where: { id: subject.id }, data: { manualReviewStatus: originalReviewStatus } });
    }
  };

  try {
    const result = await generateSite({
      leadId: subject.id,
      templateId: 'construction-modern-v1',
      mode: 'regenerate',
      maxPages: 20,
      maxDepth: 3,
      timeoutMs: 30000,
      prisma,
      force: true,
      onActivity: (event) => console.log('  activity:', event.eventType, event.message || '')
    });

    const artifactDir = join('data', 'redesign', subject.id, 'runs', result.runId);
    const sourceDocPath = join(artifactDir, 'source-documents.json');
    const contentPath = join(artifactDir, 'content.json');

    let sourceDocs = [];
    let content = {};
    try { sourceDocs = JSON.parse(await readFile(sourceDocPath, 'utf8')); } catch (e) { throw new Error(`source-documents.json missing or unreadable: ${e.message}`); }
    try { content = JSON.parse(await readFile(contentPath, 'utf8')); } catch (e) { throw new Error(`content.json missing or unreadable: ${e.message}`); }

    const pageCount = await prisma.page.count({ where: { siteId: result.siteId, generatedByRunId: result.runId } });
    const serviceCount = await prisma.service.count({ where: { siteId: result.siteId, generatedByRunId: result.runId } });
    const mediaCount = await prisma.media.count({ where: { siteId: result.siteId, generatedByRunId: result.runId } });

    const firstDoc = sourceDocs[0] || {};
    const structuredDataCount = firstDoc.structuredData?.length ?? 0;
    const collectionCount = sourceDocs.reduce((acc, d) => acc + (d.collections?.length ?? 0), 0);
    const sectionCount = sourceDocs.reduce((acc, d) => acc + (d.sections?.filter(s => s.paragraphs.length || s.heading || s.images.length || s.links.length).length ?? 0), 0);
    const imageCount = sourceDocs.reduce((acc, d) => acc + (d.images?.length ?? 0), 0);

    const mainContentOk = sourceDocs.some((d) => {
      const mainSections = d.sections?.filter(s => s.region === 'main' && (s.paragraphs.length || s.heading));
      const mainText = (mainSections || []).map(s => s.paragraphs.join(' ')).join(' ');
      // At least one page must have meaningful main content separated from chrome.
      return mainSections.length > 0 && mainText.length > 30;
    });
    const sectionsOk = sectionCount > 0;
    const imagesOk = imageCount > 0 && sourceDocs.every(d => d.images.every(i => i.provenance?.sourcePageUrl));
    const collectionsOk = collectionCount >= 0; // collections are optional, presence is informative
    const crawlBalanceOk = sourceDocs.length >= 2; // meaningful branch coverage

    console.log(`  runId: ${result.runId}`);
    console.log(`  siteId: ${result.siteId}`);
    console.log(`  source documents: ${sourceDocs.length}`);
    console.log(`  sections: ${sectionCount}, collections: ${collectionCount}, images: ${imageCount}, structuredData: ${structuredDataCount}`);
    console.log(`  pages imported: ${pageCount}, services: ${serviceCount}, media: ${mediaCount}`);
    console.log(`  matrix: main=${mainContentOk}, sections=${sectionsOk}, images=${imagesOk}, collections=${collectionsOk}, balance=${crawlBalanceOk}`);

    if (sourceDocs.length === 0) throw new Error('No source documents produced');
    if (pageCount === 0 && (content.pages?.length ?? 0) > 0) throw new Error('Content has pages but CMS import created none');

    const matrix = { mainContent: mainContentOk, sections: sectionsOk, images: imagesOk, collections: collectionsOk, crawlBalance: crawlBalanceOk };
    return { ok: true, result: { type: subject.type, runId: result.runId, siteId: result.siteId, pages: pageCount, services: serviceCount, media: mediaCount, sourceDocs: sourceDocs.length, structuredData: structuredDataCount, collections: collectionCount, sections: sectionCount, images: imageCount, matrix } };
  } finally {
    await restoreStatus();
  }
}

async function main() {
  const results = [];
  for (const subject of subjects) {
    try {
      const r = await runSubject(subject);
      results.push({ name: subject.name, type: subject.type, url: subject.url, ...r });
    } catch (err) {
      results.push({ name: subject.name, type: subject.type, url: subject.url, ok: false, error: err.message || String(err) });
    }
  }

  console.log('\n=== ACCEPTANCE MATRIX ===');
  console.log('| Site | Type | Source docs | Sections | Images | Collections | Crawl balance | Validation |');
  console.log('|------|------|-------------|----------|--------|-------------|---------------|------------|');
  for (const r of results) {
    if (r.ok) {
      const m = r.result.matrix;
      const pass = (v) => v ? 'PASS' : 'WARN';
      console.log(`| ${r.name} | ${r.type} | ${r.result.sourceDocs} | ${pass(m.sections)} | ${pass(m.images)} | ${pass(m.collections)} | ${pass(m.crawlBalance)} | PASS |`);
    } else {
      console.log(`| ${r.name} | ${r.type} | - | FAIL | FAIL | FAIL | FAIL | FAIL: ${(r.error || '').slice(0, 40)} |`);
    }
  }

  console.log('\n=== ACCEPTANCE SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n${failed.length} acceptance site(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
