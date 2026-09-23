import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { generateSite } from '../packages/redesign-engine/dist/index.js';
import { readFile, writeFile } from 'node:fs/promises';
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

function graphSummary(graph) {
  const pageTypes = {};
  for (const p of graph.pages) pageTypes[p.classification.type] = (pageTypes[p.classification.type] || 0) + 1;
  const collectionTypes = {};
  for (const p of graph.pages) {
    for (const c of p.collections) collectionTypes[c.type] = (collectionTypes[c.type] || 0) + 1;
  }
  return {
    pages: graph.pages.length,
    pageTypes,
    collections: graph.pages.reduce((a, p) => a + p.collections.length, 0),
    collectionTypes,
    rejectedCollections: graph.rejectedCollections.length,
    services: graph.services.length,
    projects: graph.projects.length,
    news: graph.news.length,
    vacancies: graph.vacancies.length,
    products: graph.products.length,
    facts: graph.facts.length,
    media: graph.media.length,
    relationships: graph.relationships.length,
    warnings: graph.warnings.length
  };
}

async function runSubject(subject) {
  console.log(`\n=== SEMANTIC ACCEPTANCE ${subject.name.toUpperCase()} (${subject.url}) ===`);
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
      mode: 'regenerate',
      semanticOnly: true,
      maxPages: 20,
      maxDepth: 3,
      timeoutMs: 30000,
      prisma,
      force: true,
      onActivity: (event) => console.log('  activity:', event.eventType, event.message || '')
    });

    const artifactDir = join('data', 'redesign', subject.id, 'runs', result.runId);
    const graphPath = join(artifactDir, 'source-content-graph.json');
    let graph;
    try { graph = JSON.parse(await readFile(graphPath, 'utf8')); } catch (e) { throw new Error(`source-content-graph.json missing or unreadable: ${e.message}`); }

    const summary = graphSummary(graph);
    console.log(`  runId: ${result.runId}`);
    console.log(`  summary: ${JSON.stringify(summary, null, 2).replace(/\n/g, '\n  ')}`);

    const pageSamples = graph.pages.slice(0, 5).map((p) => ({
      sourceDocumentId: p.sourceDocumentId,
      classification: p.classification.type,
      confidence: p.classification.confidence,
      collections: p.collections.map((c) => ({ type: c.type, subtype: c.contentSubtype, confidence: c.confidence }))
    }));

    const collectionSamples = graph.pages.flatMap((p) => p.collections.map((c) => ({
      sourceDocumentId: p.sourceDocumentId,
      collectionId: c.collectionId,
      type: c.type,
      subtype: c.contentSubtype,
      confidence: c.confidence,
      reason: c.reason
    }))).slice(0, 10);

    const company = graph.company ? {
      displayName: graph.company.displayName,
      legalName: graph.company.legalName,
      confidence: graph.company.confidence,
      founded: graph.company.founded,
      employees: graph.company.employees,
      unp: graph.company.unp
    } : null;

    const contacts = graph.contacts ? {
      phoneCount: graph.contacts.phones?.length ?? 0,
      emailCount: graph.contacts.emails?.length ?? 0,
      addressCount: graph.contacts.addresses?.length ?? 0,
      socialCount: graph.contacts.socialLinks?.length ?? 0
    } : null;

    return {
      ok: true,
      result: {
        type: subject.type,
        runId: result.runId,
        artifactDir,
        graphPath,
        summary,
        company,
        contacts,
        pageSamples,
        collectionSamples,
        warnings: graph.warnings.slice(0, 10)
      }
    };
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

  const matrixPath = `data/redesign/semantic-acceptance-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  await writeFile(matrixPath, JSON.stringify(results, null, 2));

  console.log('\n=== SEMANTIC ACCEPTANCE MATRIX ===');
  console.log('| Site | Pages | Services | Projects | News | Contacts | Warnings |');
  console.log('|------|-------|----------|----------|------|----------|----------|');
  for (const r of results) {
    if (r.ok) {
      const s = r.result.summary;
      console.log(`| ${r.name} | ${s.pages} | ${s.services} | ${s.projects} | ${s.news} | ${r.result.contacts ? 'yes' : 'no'} | ${s.warnings} |`);
    } else {
      console.log(`| ${r.name} | FAIL | FAIL | FAIL | FAIL | FAIL | ${(r.error || '').slice(0, 30)} |`);
    }
  }
  console.log(`\nDetailed results written to ${matrixPath}`);

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n${failed.length} semantic acceptance site(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
