// Run the provider-neutral EditorialQA (deterministic, no external calls)
// over the canonical Lishen CMS content and write
// data/redesign/v362/editorial-qa-report.json.
import { runEditorialQa } from '../packages/redesign-engine/dist/index.js';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
const SITE_ID = 'cmuazd8v900011kiu4bp2hsnf';
const OUT = path.resolve('data/redesign/v362/editorial-qa-report.json');

function blockText(b) {
  const parts = [];
  if (b.heading) parts.push(b.heading);
  if (b.title) parts.push(b.title);
  if (b.subtitle) parts.push(b.subtitle);
  if (b.content) parts.push(b.content);
  if (b.description) parts.push(b.description);
  if (b.caption) parts.push(b.caption);
  if (b.buttonLabel) parts.push(b.buttonLabel);
  for (const it of b.items || []) {
    if (it.title) parts.push(it.title);
    if (it.text) parts.push(it.text);
    if (it.question) parts.push(it.question);
    if (it.answer) parts.push(it.answer);
    if (it.summary) parts.push(it.summary);
    if (it.description) parts.push(it.description);
    if (it.caption) parts.push(it.caption);
  }
  return parts.filter(Boolean).join('\n');
}

const inputs = [];
const pages = await prisma.page.findMany({ where: { siteId: SITE_ID } });
for (const page of pages) {
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  for (const b of blocks) {
    const text = blockText(b);
    if (!text.trim()) continue;
    inputs.push({
      entityId: `page:${page.slug}`,
      blockId: b.id || `${page.slug}#${blocks.indexOf(b)}`,
      text,
      evidenceIds: [page.sourceUrl, b.sourceUrl, b.provenance?.sourceUrl].filter(Boolean),
    });
  }
}

for (const [model, prefix] of [['service', 'service'], ['project', 'project']]) {
  const rows = await prisma[model].findMany({ where: { siteId: SITE_ID } });
  for (const row of rows) {
    const blocks = Array.isArray(row.blocks) ? row.blocks : [];
    for (const b of blocks) {
      const text = blockText(b);
      if (!text.trim()) continue;
      inputs.push({
        entityId: `${prefix}:${row.slug}`,
        blockId: b.id || `${row.slug}#${blocks.indexOf(b)}`,
        text,
        evidenceIds: [row.sourceUrl, b.sourceUrl, b.provenance?.sourceUrl].filter(Boolean),
      });
    }
    // Top-level text fields are also canonical content.
    const top = [row.summary, row.description, row.content].filter(Boolean).join('\n');
    if (top.trim()) {
      inputs.push({ entityId: `${prefix}:${row.slug}`, blockId: 'fields', text: top, evidenceIds: [row.sourceUrl].filter(Boolean) });
    }
  }
}

const report = await runEditorialQa(inputs);
report.inputs = inputs.map((i) => ({ entityId: i.entityId, blockId: i.blockId, chars: i.text.length, evidenceIds: i.evidenceIds }));
report.hardConstraints = {
  noExternalCalls: true,
  noAutoRewriteOfNumbers: true,
  noAutoRewriteOfLegalOrWarranty: true,
  suggestionsReviewableOnly: true,
  noCmsApplication: true,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

const byKind = {};
for (const i of report.issues) byKind[i.kind] = (byKind[i.kind] || 0) + 1;
console.log('inputs:', report.inputCount, '| issues:', report.issues.length, '| conflicts:', report.conflicts.length);
console.log('by kind:', JSON.stringify(byKind));
console.log('conflicts:', report.conflicts.map((c) => c.text).join(' || '));
console.log('wrote', OUT);
await prisma.$disconnect();
