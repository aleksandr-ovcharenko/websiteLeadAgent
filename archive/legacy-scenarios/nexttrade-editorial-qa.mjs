// V3.7 Phase 9 — deterministic EditorialQA over NextTrade SourceDocuments.
import { runEditorialQa } from '../packages/redesign-engine/dist/index.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/redesign/v37/nexttrade');

const docs = JSON.parse(await readFile(path.join(OUT, 'source-documents.json'), 'utf8'));

const input = [];
for (const doc of docs) {
  for (const sec of doc.sections || []) {
    if (sec.heading) input.push({ entityId: doc.id, blockId: sec.id, field: 'heading', text: sec.heading });
    for (const p of sec.paragraphs || []) input.push({ entityId: doc.id, blockId: sec.id, field: 'paragraph', text: p });
    for (const f of sec.faqs || []) {
      input.push({ entityId: doc.id, blockId: sec.id, field: 'faq-q', text: f.question });
      input.push({ entityId: doc.id, blockId: sec.id, field: 'faq-a', text: f.answer });
    }
  }
  for (const col of doc.collections || []) {
    for (const it of col.items || []) {
      if (it.title) input.push({ entityId: doc.id, blockId: col.id, field: 'item-title', text: it.title });
      if (it.description) input.push({ entityId: doc.id, blockId: col.id, field: 'item-desc', text: it.description });
    }
  }
}

const report = await runEditorialQa(input);
await writeFile(path.join(OUT, 'editorial-qa.json'), JSON.stringify(report, null, 2));

const bySev = {};
const byKind = {};
for (const i of report.issues) {
  bySev[i.severity] = (bySev[i.severity] || 0) + 1;
  byKind[i.kind] = (byKind[i.kind] || 0) + 1;
}
console.log(`inputs: ${report.inputCount} | mode: ${report.mode}`);
console.log('issues by severity:', bySev);
console.log('issues by kind:', byKind);
console.log('conflicts:', report.conflicts.length);
for (const c of report.conflicts.slice(0, 10)) console.log(' CONFLICT:', c.kind, '|', c.text.slice(0, 90));
