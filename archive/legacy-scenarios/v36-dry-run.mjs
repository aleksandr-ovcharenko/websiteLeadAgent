// V3.6 offline verification: crawl.json → SourceDocuments → Graph → adapter
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { buildSourceDocuments } from '../packages/redesign-engine/dist/extract/buildSourceDocuments.js';
import { buildSourceContentGraph } from '../packages/redesign-engine/dist/semantic/graph.js';
import { graphToImportContent } from '../packages/redesign-engine/dist/import/graphToImportContent.js';

const dir = 'data/redesign/pilot-2b/lishen';
const out = 'data/redesign/v36/pipeline-dry-run';
await mkdir(out, { recursive: true });
const crawl = JSON.parse(await readFile(`${dir}/crawl-full.json`, 'utf8'));
const baseUrl = "https://lishen.by/" || 'https://lishen.by/';

const sourceDocuments = buildSourceDocuments(crawl);
await writeFile(`${out}/source-documents.json`, JSON.stringify(sourceDocuments, null, 2));

const graph = await buildSourceContentGraph({ sourceDocuments, baseUrl });
await writeFile(`${out}/source-content-graph.json`, JSON.stringify(graph, null, 2));

const nav = sourceDocuments.find(d => d.isHomepage)?.chrome.nav?.primary || sourceDocuments[0]?.chrome.nav?.primary || [];
const { content, provenance } = graphToImportContent({ graph, sourceDocuments, baseUrl, navigation: nav });
await writeFile(`${out}/content.json`, JSON.stringify(content, null, 2));
await writeFile(`${out}/graph-import-provenance.json`, JSON.stringify(provenance, null, 2));

console.log('=== PAGE TYPES ===');
for (const p of graph.pages) {
  const doc = sourceDocuments.find(d => d.id === p.sourceDocumentId);
  console.log(p.classification.type.padEnd(16), doc?.path, '| sections:', doc?.sections.length, '| mainText:', (doc?.mainText||'').length);
}
console.log('=== SERVICES ===');
for (const s of content.services) console.log(' •', s.title, '| slug:', s.slug, '| src:', s.sourceUrl, '| desc:', (s.shortDescription||'').slice(0,80));
console.log('=== PROJECTS ===');
for (const p of content.projects) console.log(' •', p.title, '| cat:', p.category, '| cover:', (p.coverImage?.sourceUrl||'NONE').split('/').pop(), '| gallery:', p.gallery.length);
console.log('=== DROPPED ===');
for (const d of provenance.droppedEntities) console.log(' ✗', d.title, '—', d.reason);
console.log('=== MEDIA ROLES ===');
const roles = {};
for (const m of graph.media) roles[m.role] = (roles[m.role]||0)+1;
console.log(roles);
console.log('=== CONTACTS ===', JSON.stringify(content.contacts));
console.log('=== NAV ===');
for (const n of content.navigation) console.log(' •', n.label, '→', n.url, n.children?.length ? `(+${n.children.length} children)` : '');
console.log('=== HERO ===', JSON.stringify(content.hero).slice(0,400));
console.log('=== CTA ===', JSON.stringify(content.cta).slice(0,300));
