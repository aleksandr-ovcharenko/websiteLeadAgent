// V3.7 Phase 5 — real crawl of nexttrade.by through the WLA pipeline.
// Emits data/redesign/v37/nexttrade/crawl-inventory.json.
import { runCrawl } from '../packages/redesign-engine/dist/index.js';
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/redesign/v37/nexttrade');
const LEAD_ID = 'cmtnjmlpp003p99lgysdt7w7h';

const prisma = new PrismaClient();

function textSignature(text) {
  return createHash('sha1')
    .update((text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 4000))
    .digest('hex').slice(0, 16);
}

function classifyPath(url) {
  const p = new URL(url).pathname.toLowerCase();
  if (/\/(news|blog|articles?|novosti|stati)/.test(p)) return 'ARTICLE_OR_NEWS';
  if (/\/(projects?|works|portfolio|proekty|kejsy|cases)/.test(p)) return 'PROJECT';
  if (/\/(services?|uslugi)/.test(p)) return 'SERVICE';
  if (/\/(catalog|katalog|oborudovanie|equipment|products?|tovary|shop)/.test(p)) return 'EQUIPMENT_OR_PRODUCT';
  if (/\/(contacts?|kontakty)/.test(p)) return 'CONTACTS';
  if (/\/(faq|voprosy|questions)/.test(p)) return 'FAQ';
  if (/\/(team|komanda|about|o-kompanii|company)/.test(p)) return 'ABOUT_OR_TEAM';
  if (p === '/' || p === '') return 'HOMEPAGE';
  return 'PAGE';
}

const { run, crawlResult, crawlJsonPath } = await runCrawl({
  leadId: LEAD_ID,
  prisma,
  maxPages: 80,
  maxDepth: 4,
  timeoutMs: 30000,
  force: true,
  onActivity: (e) => console.log(`[${e.level}] ${e.eventType} ${e.message}`),
});

const sigCount = new Map();
for (const pg of crawlResult.pages) {
  const sig = textSignature(pg.text);
  sigCount.set(sig, (sigCount.get(sig) || 0) + 1);
  pg._sig = sig;
}

const inventory = {
  generatedAt: new Date().toISOString(),
  crawlRunId: run.id,
  leadId: LEAD_ID,
  crawlJsonPath,
  rootResolution: crawlResult.rootResolution ?? null,
  homepage: crawlResult.homepage,
  warnings: crawlResult.warnings,
  summary: {
    pages: crawlResult.pages.length,
    planned: crawlResult.crawlPlan?.length ?? null,
    skipped: crawlResult.skipped.length,
    duplicateSignatures: [...sigCount.values()].filter((c) => c > 1).length,
  },
  pages: crawlResult.pages.map((pg) => ({
    requestedUrl: pg.requestedUrl ?? null,
    url: pg.url,
    finalUrl: pg.finalUrl ?? pg.url,
    canonicalUrl: pg.canonicalUrl ?? null,
    httpStatus: crawlResult.crawlPlan?.find((c) => c.documentUrl === pg.url || c.finalUrl === pg.url)?.status ?? null,
    title: pg.title,
    h1: pg.h1,
    path: pg.path,
    depth: pg.depth,
    detectedEntityType: classifyPath(pg.url),
    internalLinks: pg.links.length,
    mediaCount: pg.images.length,
    navItem: !!pg.navItem,
    duplicateSignature: pg._sig,
    duplicateOf: sigCount.get(pg._sig) > 1 ? crawlResult.pages.find((o) => o !== pg && o._sig === pg._sig)?.url ?? null : null,
    inclusionReason: 'CRAWLED',
  })),
  excluded: [
    ...(crawlResult.skipped || []).map((s) => ({ url: s.url, reason: s.reason })),
    ...(crawlResult.crawlPlan || []).filter((c) => !c.attempted || (c.result && c.result !== 'CRAWLED')).map((c) => ({
      url: c.url, result: c.result ?? 'NOT_ATTEMPTED', status: c.status ?? null, failureReason: c.failureReason ?? null, source: c.source, depth: c.depth,
    })),
  ],
};

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'crawl-inventory.json'), JSON.stringify(inventory, null, 2));
console.log('crawlRunId:', run.id);
console.log('pages:', crawlResult.pages.length, 'warnings:', crawlResult.warnings.length, 'skipped:', crawlResult.skipped.length);
console.log('inventory →', path.join(OUT, 'crawl-inventory.json'));
await prisma.$disconnect();
