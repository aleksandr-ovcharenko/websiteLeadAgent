import { readdir, readFile, writeFile } from 'node:fs/promises';

function norm(s) { return (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' '); }

const files = (await readdir('data/redesign')).filter((f) => f.startsWith('semantic-acceptance-') && f.endsWith('.json')).sort();
const latest = files[files.length - 1];
const acceptance = JSON.parse(await readFile('data/redesign/' + latest, 'utf8'));

function canonical(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, '').toLowerCase();
  } catch { return url.toLowerCase().replace(/\/$/, ''); }
}

function slugify(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ').slice(0, 60);
}

const report = [];

for (const r of acceptance) {
  if (!r.ok) {
    report.push({ site: r.name, ok: false, error: r.error });
    continue;
  }
  const sourceDocsPath = `${r.result.artifactDir}/source-documents.json`;
  const docs = JSON.parse(await readFile(sourceDocsPath, 'utf8'));
  const graph = JSON.parse(await readFile(r.result.graphPath, 'utf8'));
  const docById = Object.fromEntries(docs.map((d) => [d.id, d]));
  const pageByDocId = Object.fromEntries(graph.pages.map((p) => [p.sourceDocumentId, p]));

  const docUrl = (id) => docById[id]?.url;

  const entityAudit = (list, name) => {
    const byKey = new Map();
    const details = [];
    for (const e of list) {
      const key = slugify(e.title);
      const existing = byKey.get(key);
      if (existing) existing.push(e); else byKey.set(key, [e]);
      details.push({
        id: e.id,
        title: e.title,
        status: e.status,
        confidence: e.confidence,
        sourceUrl: e.sourceDocumentIds?.[0] ? docUrl(e.sourceDocumentIds[0]) : undefined,
        canonicalUrl: e.sourceDocumentIds?.[0] ? canonical(docUrl(e.sourceDocumentIds[0])) : undefined,
        evidenceCount: e.evidence?.length || 0,
        evidenceTypes: e.evidence?.map((x) => x.type),
        hasDescription: !!e.description && e.description.length > 20,
        duplicateGroup: key,
      });
    }
    const duplicates = [...byKey.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ key: k, count: v.length, titles: v.map((x) => x.title) }));
    return { count: list.length, duplicateGroups: duplicates.length, duplicateTitles: duplicates, details };
  };

  const services = entityAudit(graph.services, 'services');
  const projects = entityAudit(graph.projects, 'projects');
  const news = entityAudit(graph.news, 'news');
  const products = entityAudit(graph.products, 'products');

  // News index/detail overlap
  const newsByUrl = new Map();
  for (const e of graph.news) {
    const url = e.sourceDocumentIds?.[0] ? docUrl(e.sourceDocumentIds[0]) : undefined;
    const key = url ? canonical(url) : slugify(e.title);
    const arr = newsByUrl.get(key) || [];
    arr.push(e);
    newsByUrl.set(key, arr);
  }
  const newsIndexDetailOverlap = [...newsByUrl.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ key: k, count: v.length, titles: v.map((x) => x.title), sourceUrls: v.map((x) => x.sourceDocumentIds?.[0] ? docUrl(x.sourceDocumentIds[0]) : undefined) }));

  // Collection diagnostics
  const collectionDiagnostics = [];
  for (const p of graph.pages) {
    const doc = docById[p.sourceDocumentId];
    const sourceColls = doc?.collections || [];
    for (const c of p.collections) {
      const src = sourceColls.find((sc) => sc.id === c.collectionId);
      collectionDiagnostics.push({
        docUrl: doc?.url,
        collectionId: c.collectionId,
        type: c.type,
        contentSubtype: c.contentSubtype,
        confidence: c.confidence,
        reason: c.reason,
        itemCount: src?.items?.length || 0,
        sampleTitles: src?.items?.slice(0, 5).map((i) => i.title),
      });
    }
  }

  // Rejected collection reasons
  const rejectedReasons = {};
  for (const rc of graph.rejectedCollections || []) {
    rejectedReasons[rc.type] = (rejectedReasons[rc.type] || 0) + 1;
  }

  // Page type distribution
  const pageTypes = {};
  for (const p of graph.pages) pageTypes[p.classification.type] = (pageTypes[p.classification.type] || 0) + 1;

  // Low confidence / OTHER pages
  const otherPages = graph.pages.filter((p) => p.classification.type === 'OTHER').map((p) => ({ url: docUrl(p.sourceDocumentId), confidence: p.classification.confidence, quality: p.quality }));

  report.push({
    site: r.name,
    url: r.url,
    ok: true,
    pages: { total: graph.pages.length, types: pageTypes, otherPages },
    collections: { total: collectionDiagnostics.length, byReason: rejectedReasons, diagnostics: collectionDiagnostics.slice(0, 10) },
    services,
    projects,
    news: { ...news, indexDetailOverlap: newsIndexDetailOverlap },
    products,
  });
}

const outPath = `data/redesign/semantic-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(outPath, JSON.stringify(report, null, 2));
console.log('wrote', outPath);
