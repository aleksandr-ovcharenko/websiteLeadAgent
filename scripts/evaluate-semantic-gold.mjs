#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const GOLD_PATH = process.env.GOLD_PATH || 'packages/redesign-engine/test/fixtures/semantic-gold.json';
const MATRIX_PATH = process.env.MATRIX_PATH || process.argv[2];

if (!MATRIX_PATH) {
  console.error('Usage: evaluate-semantic-gold.mjs <semantic-rerun-matrix.json>');
  process.exit(1);
}

const norm = (s) => (s || '').toLowerCase().replace(/[\s\-_.]+/g, ' ').trim();
const canonicalUrl = (url) => {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    let p = u.pathname.replace(/index\.html?$/i, '');
    if (!p.endsWith('/')) p += '/';
    return `${u.hostname}${p}`;
  } catch {
    return url.toLowerCase().replace(/index\.html?$/i, '').replace(/\/+$/, '/');
  }
};

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function normalizeForMatch(s) {
  // collapse quotes and strip legal forms
  return norm(s).replace(/[«»""''„“]/g, '').replace(/\b(оао|зао|ао|уп|ип|ооо|llc|inc|ltd|gmbh)\b/igu, '').trim();
}

const gold = loadJson(GOLD_PATH);
const matrix = loadJson(MATRIX_PATH);

const siteToGraph = new Map();
const siteToDocs = new Map();
for (const entry of matrix) {
  siteToGraph.set(entry.name, loadJson(path.resolve(entry.graphPath)));
  const docsPath = entry.graphPath.replace('source-content-graph-v2.json', 'source-documents.json');
  siteToDocs.set(entry.name, loadJson(path.resolve(docsPath)));
}

const results = {
  pages: { correct: 0, total: 0, errors: [] },
  collections: { correct: 0, total: 0, errors: [] },
  entities: { truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 0, errors: [] },
};

function findPage(site, url) {
  const graph = siteToGraph.get(site);
  const target = canonicalUrl(url);
  return graph?.pages.find((p) => {
    const srcDoc = siteToDocs.get(site)?.find((d) => d.id === p.sourceDocumentId);
    return canonicalUrl(srcDoc?.url || p.sourceDocumentId) === target;
  });
}

for (const sample of gold.pages || []) {
  results.pages.total++;
  const page = findPage(sample.site, sample.url);
  if (!page) {
    results.pages.errors.push({ sample, reason: 'page not found' });
    continue;
  }
  const typeOk = page.classification.type === sample.expected;
  const categoryOk = sample.expectedCategory ? page.classification.category === sample.expectedCategory : true;
  const subTypeOk = sample.expectedSubType ? page.classification.subType === sample.expectedSubType : true;
  if (typeOk && categoryOk && subTypeOk) {
    results.pages.correct++;
  } else {
    results.pages.errors.push({ sample, actual: page.classification, reason: 'type/category/subtype mismatch' });
  }
}

function findCollection(site, docUrl, selectorHint, expectedType, expectedSubtype) {
  const graph = siteToGraph.get(site);
  const docs = siteToDocs.get(site);
  const target = canonicalUrl(docUrl);
  const doc = docs?.find((d) => canonicalUrl(d.url) === target);
  if (!doc) return null;
  const page = graph?.pages.find((p) => p.sourceDocumentId === doc.id);
  if (!page) return null;

  // First try to match by selector hint against source document collection selectors.
  const rawColl = doc.collections?.find((c) => (c.selector || '').toLowerCase().includes(selectorHint.toLowerCase()));
  let classification = page.collections.find((c) => c.collectionId === rawColl?.id);

  // Fallback: any collection on the page that matches the expected classification.
  if (!classification) {
    classification = page.collections.find((c) => {
      if (c.type !== expectedType) return false;
      if (expectedSubtype && c.contentSubtype !== expectedSubtype) return false;
      return true;
    });
  }
  return { raw: rawColl, classification };
}

for (const sample of gold.collections || []) {
  results.collections.total++;
  const found = findCollection(sample.site, sample.docUrl, sample.selectorHint, sample.expectedType, sample.expectedSubtype);
  if (!found?.classification) {
    results.collections.errors.push({ sample, reason: 'collection not found' });
    continue;
  }
  const c = found.classification;
  const typeOk = c.type === sample.expectedType;
  const subtypeOk = sample.expectedSubtype ? c.contentSubtype === sample.expectedSubtype : true;
  if (typeOk && subtypeOk) {
    results.collections.correct++;
  } else {
    results.collections.errors.push({ sample, actual: c, reason: 'type/subtype mismatch' });
  }
}

function findEntity(graph, type, title) {
  const arr = graph?.[type === 'project' ? 'projects' : type === 'service' ? 'services' : type === 'product' ? 'products' : type === 'vacancy' ? 'vacancies' : type === 'news' ? 'news' : type === 'page' ? 'pages' : null];
  if (!arr) return null;
  const needle = normalizeForMatch(title);
  const hit = arr.find((e) => normalizeForMatch(e.title || '').includes(needle) || needle.includes(normalizeForMatch(e.title || '')));
  return hit || null;
}

for (const sample of gold.entitySamples || []) {
  const graph = siteToGraph.get(sample.site);
  if (sample.type === 'page') {
    results.entities.total = (results.entities.total || 0) + 1;
    const page = findPage(sample.site, sample.url);
    const ok = page && page.classification.type === sample.expectedType &&
      (sample.expectedCategory ? page.classification.category === sample.expectedCategory : true) &&
      (sample.expectedSubType ? page.classification.subType === sample.expectedSubType : true);
    if (ok) {
      results.entities.truePositives++;
    } else if (sample.expected) {
      results.entities.falseNegatives++;
      results.entities.errors.push({ sample, actual: page?.classification, reason: 'expected page not found or wrong type' });
    } else {
      results.entities.falsePositives++;
      results.entities.errors.push({ sample, actual: page?.classification, reason: 'unexpected page found' });
    }
    continue;
  }
  const hit = findEntity(graph, sample.type, sample.title);
  if (sample.expected) {
    results.entities.total = (results.entities.total || 0) + 1;
    if (hit) {
      results.entities.truePositives++;
    } else {
      results.entities.falseNegatives++;
      results.entities.errors.push({ sample, reason: 'expected entity missing' });
    }
  } else {
    // For "expected=false" samples we only have a title; treat a hit as false positive.
    if (hit) {
      results.entities.falsePositives++;
      results.entities.errors.push({ sample, reason: 'unexpected entity found', actual: hit.title });
    } else {
      results.entities.trueNegatives++;
    }
  }
}

const pageAccuracy = results.pages.total ? results.pages.correct / results.pages.total : 0;
const collectionAccuracy = results.collections.total ? results.collections.correct / results.collections.total : 0;
const pos = results.entities.truePositives + results.entities.falsePositives;
const entityPrecision = pos ? results.entities.truePositives / pos : 0;
const recDenom = results.entities.truePositives + results.entities.falseNegatives;
const entityRecall = recDenom ? results.entities.truePositives / recDenom : 0;
const f1 = entityPrecision + entityRecall ? (2 * entityPrecision * entityRecall) / (entityPrecision + entityRecall) : 0;

const report = {
  generatedAt: new Date().toISOString(),
  goldVersion: gold.version,
  matrix: MATRIX_PATH,
  pageAccuracy,
  collectionAccuracy,
  entityPrecision,
  entityRecall,
  entityF1: f1,
  overall: (pageAccuracy + collectionAccuracy + f1) / 3,
  pageDetails: results.pages,
  collectionDetails: results.collections,
  entityDetails: results.entities,
};

const outJson = `data/redesign/semantic-gold-evaluation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

let md = `# Semantic Gold Evaluation Report\n\n`;
md += `* Generated: ${report.generatedAt}\n`;
md += `* Gold version: ${report.goldVersion}\n`;
md += `* Matrix: ${report.matrix}\n\n`;
md += `## Metrics\n\n`;
md += `| Metric | Value |\n|---|---|\n`;
md += `| Page accuracy | ${(pageAccuracy * 100).toFixed(1)}% |\n`;
md += `| Collection accuracy | ${(collectionAccuracy * 100).toFixed(1)}% |\n`;
md += `| Entity precision | ${(entityPrecision * 100).toFixed(1)}% |\n`;
md += `| Entity recall | ${(entityRecall * 100).toFixed(1)}% |\n`;
md += `| Entity F1 | ${(f1 * 100).toFixed(1)}% |\n`;
md += `| Overall | ${(report.overall * 100).toFixed(1)}% |\n\n`;
md += `## Errors\n\n`;
md += `### Page errors (${results.pages.errors.length})\n\n`;
md += results.pages.errors.map((e) => `- ${e.sample.site} ${e.sample.url}: expected ${e.sample.expected} ${e.sample.expectedCategory ? '/' + e.sample.expectedCategory + '/' + e.sample.expectedSubType : ''}, actual ${e.reason === 'page not found' ? 'page not found' : JSON.stringify(e.actual)}`).join('\n') + '\n\n';
md += `### Collection errors (${results.collections.errors.length})\n\n`;
md += results.collections.errors.map((e) => `- ${e.sample.site} ${e.sample.docUrl} [${e.sample.selectorHint}]: expected ${e.sample.expectedType}${e.sample.expectedSubtype ? '/' + e.sample.expectedSubtype : ''}, actual ${e.reason === 'collection not found' ? 'collection not found' : JSON.stringify(e.actual)}`).join('\n') + '\n\n';
md += `### Entity errors (${results.entities.errors.length})\n\n`;
md += results.entities.errors.map((e) => `- ${e.sample.site} ${e.sample.type} "${e.sample.title || e.sample.url}": ${e.reason}`).join('\n') + '\n';

const outMd = `data/redesign/semantic-gold-evaluation-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
fs.writeFileSync(outMd, md);

console.log(`Wrote ${outJson}`);
console.log(`Wrote ${outMd}`);
console.log(`Overall: ${(report.overall * 100).toFixed(1)}% (pages ${(pageAccuracy * 100).toFixed(1)}%, collections ${(collectionAccuracy * 100).toFixed(1)}%, entity F1 ${(f1 * 100).toFixed(1)}%)`);
