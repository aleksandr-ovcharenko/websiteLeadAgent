import { readFile, writeFile, readdir } from 'node:fs/promises';
import { buildSourceDocuments } from '../packages/redesign-engine/dist/extract/buildSourceDocuments.js';

const files = (await readdir('data/redesign')).filter((f) => f.startsWith('semantic-acceptance-') && f.endsWith('.json')).sort();
const acceptance = JSON.parse(await readFile('data/redesign/' + files[files.length - 2], 'utf8'));

for (const r of acceptance) {
  if (!r.ok || !r.result?.artifactDir) continue;
  const crawlPath = `${r.result.artifactDir}/crawl.json`;
  const docsPath = `${r.result.artifactDir}/source-documents.json`;
  const crawl = JSON.parse(await readFile(crawlPath, 'utf8'));
  const docs = buildSourceDocuments(crawl);
  await writeFile(docsPath, JSON.stringify(docs, null, 2));
  console.log('regenerated', r.name, docs.length, 'docs ->', docsPath);
}
