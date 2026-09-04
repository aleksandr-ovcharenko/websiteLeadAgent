import { readFile, readdir, writeFile } from 'node:fs/promises';
import { buildSourceContentGraph } from '../packages/redesign-engine/dist/semantic/graph.js';

const files = (await readdir('data/redesign')).filter((f) => f.startsWith('semantic-acceptance-') && f.endsWith('.json')).sort();
const latest = files[files.length - 2]; // second to last, the last one is the failed run
const acceptance = JSON.parse(await readFile('data/redesign/' + latest, 'utf8'));

const results = [];
for (const r of acceptance) {
  if (!r.ok) { results.push(r); continue; }
  const sourceDocsPath = `${r.result.artifactDir}/source-documents.json`;
  const docs = JSON.parse(await readFile(sourceDocsPath, 'utf8'));
  const graph = buildSourceContentGraph({ sourceDocuments: docs, baseUrl: r.url, runId: r.result.runId });
  const newPath = `${r.result.artifactDir}/source-content-graph-v2.json`;
  await writeFile(newPath, JSON.stringify(graph, null, 2));

  const pageTypes = {};
  for (const p of graph.pages) pageTypes[p.classification.type] = (pageTypes[p.classification.type] || 0) + 1;
  const collectionTypes = {};
  for (const page of graph.pages) for (const c of page.collections) collectionTypes[c.type] = (collectionTypes[c.type] || 0) + 1;

  results.push({
    name: r.name,
    url: r.url,
    ok: true,
    runId: r.result.runId,
    graphPath: newPath,
    summary: {
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
      warnings: graph.warnings.length,
    },
  });
}

const outPath = `data/redesign/semantic-rerun-v2-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(outPath, JSON.stringify(results, null, 2));
console.log('wrote', outPath);
