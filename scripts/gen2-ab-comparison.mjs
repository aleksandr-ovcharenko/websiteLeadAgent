#!/usr/bin/env node
// Phase 2A.3 A/B: same SourceDocuments -> RULE graph vs HYBRID (rule+Gemini)
// graph per site, evaluated against the reviewed gold set.
//
// Usage: node scripts/gen2-ab-comparison.mjs [--skip-crawl]
//   --skip-crawl  reuse existing data/redesign/<leadId>/runs/*/source-documents.json
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { crawlSite } from '../packages/redesign-engine/dist/index.js';
import { buildSourceDocuments } from '../packages/redesign-engine/dist/extract/buildSourceDocuments.js';
import { buildSourceContentGraph, loadSourceDocuments } from '../packages/redesign-engine/dist/semantic/graph.js';
import { RuleBasedSemanticProvider } from '../packages/redesign-engine/dist/semantic/ruleBasedProvider.js';
import { HybridGeminiProvider } from '../packages/redesign-engine/dist/semantic/geminiSemanticProvider.js';

const SKIP_CRAWL = process.argv.includes('--skip-crawl');
const RULE_ONLY = process.argv.includes('--rule-only');
const CACHE_PROOF = process.argv.includes('--cache-proof');
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = `data/redesign/ab-${TS}`;

// Regression fixtures only — no domain-specific branches anywhere.
const subjects = [
  { name: 'mapid', url: 'https://mapid.by/' },
  { name: 'radlen', url: 'https://radlen.by/' },
  { name: 'minskdsk', url: 'http://minskdsk.by/' },
  { name: 'savit', url: 'https://savit.by/' },
  { name: 'a100', url: 'https://a-100development.by/' },
  { name: 'northwaterfront', url: 'https://mcnorthwaterfront.by/ru' },
];

const GOLD = JSON.parse(fs.readFileSync('packages/redesign-engine/test/fixtures/semantic-gold.json', 'utf8'));

const norm = (s) => (s || '').toLowerCase().replace(/[\s\-_.«»""''„“]+/g, ' ').trim();
const canonicalUrl = (url) => {
  try {
    const u = new URL(url);
    u.hash = ''; u.search = '';
    let p = u.pathname.replace(/index\.html?$/i, '');
    if (!p.endsWith('/')) p += '/';
    return `${u.hostname}${p}`;
  } catch { return (url || '').toLowerCase().replace(/index\.html?$/i, '').replace(/\/+$/, '/'); }
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

async function ensureSourceDocuments(subject) {
  const siteDir = path.join('data', 'redesign', subject.name);
  const docsPath = path.join(siteDir, 'source-documents.json');
  if (SKIP_CRAWL && fs.existsSync(docsPath)) {
    const crawlPath = path.join(siteDir, 'crawl.json');
    const crawlResult = fs.existsSync(crawlPath) ? JSON.parse(fs.readFileSync(crawlPath, 'utf8')).crawlResult : undefined;
    return { path: docsPath, reused: true, crawlResult };
  }
  console.log(`  [crawl] live crawl ${subject.url} ...`);
  const crawlResult = await crawlSite({ baseUrl: subject.url, maxPages: 30, maxDepth: 3, timeoutMs: 30000, rootTimeoutMs: 45000, rootRetries: 1 });
  const docs = buildSourceDocuments(crawlResult);
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(siteDir, 'crawl.json'), JSON.stringify({ baseUrl: subject.url, pages: crawlResult.pages?.length ?? 0, warnings: crawlResult.warnings, skipped: crawlResult.skipped, crawlResult }, null, 2));
  fs.writeFileSync(path.join(siteDir, 'crawl-plan.json'), JSON.stringify({ rootResolution: crawlResult.rootResolution, homepage: crawlResult.homepage, plan: crawlResult.crawlPlan || [] }, null, 2));
  fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2));
  return { path: docsPath, reused: false, crawlResult };
}

// --- gold evaluation -------------------------------------------------------

function evaluateSite(name, docs, graph) {
  const docByUrl = new Map(docs.map((d) => [canonicalUrl(d.url), d]));
  const docById = new Map(docs.map((d) => [d.id, d]));

  const pageEval = { correct: 0, wrong: 0, missing: 0, coarseCorrect: 0, errors: [] };
  for (const sample of (GOLD.pages || []).filter((p) => p.site === name)) {
    const doc = docByUrl.get(canonicalUrl(sample.url));
    const page = doc && graph.pages.find((p) => p.sourceDocumentId === doc.id);
    if (!page) { pageEval.missing++; pageEval.errors.push({ url: sample.url, reason: 'page not in graph' }); continue; }
    const typeOk = page.classification.type === sample.expected;
    const catOk = !sample.expectedCategory || page.classification.category === sample.expectedCategory;
    const subOk = !sample.expectedSubType || page.classification.subType === sample.expectedSubType;
    if (catOk) pageEval.coarseCorrect++;
    if (typeOk && catOk && subOk) pageEval.correct++;
    else { pageEval.wrong++; pageEval.errors.push({ url: sample.url, expected: sample.expected, actual: page.classification.type, cat: page.classification.category, sub: page.classification.subType }); }
  }

  const collEval = { correct: 0, wrong: 0, missing: 0, errors: [] };
  for (const sample of (GOLD.collections || []).filter((c) => c.site === name)) {
    const doc = docByUrl.get(canonicalUrl(sample.docUrl));
    if (!doc) { collEval.missing++; continue; }
    const page = graph.pages.find((p) => p.sourceDocumentId === doc.id);
    if (!page) { collEval.missing++; continue; }
    const rawColl = doc.collections?.find((c) => (c.selector || '').toLowerCase().includes((sample.selectorHint || '').toLowerCase()));
    let classification = rawColl && page.collections.find((c) => c.collectionId === rawColl.id);
    if (!classification) classification = page.collections.find((c) => c.type === sample.expectedType && (!sample.expectedSubtype || c.contentSubtype === sample.expectedSubtype));
    if (!classification) { collEval.missing++; collEval.errors.push({ doc: sample.docUrl, hint: sample.selectorHint, reason: 'collection not classified' }); continue; }
    const ok = classification.type === sample.expectedType && (!sample.expectedSubtype || classification.contentSubtype === sample.expectedSubtype);
    if (ok) collEval.correct++;
    else { collEval.wrong++; collEval.errors.push({ doc: sample.docUrl, hint: sample.selectorHint, expected: `${sample.expectedType}/${sample.expectedSubtype || ''}`, actual: `${classification.type}/${classification.contentSubtype || ''}` }); }
  }

  // Per-entity-type P/R from entitySamples (title match, expected=true/false).
  const ent = {};
  const buckets = { project: 'projects', news: 'news', service: 'services', vacancy: 'vacancies', product: 'products' };
  for (const sample of (GOLD.entitySamples || []).filter((e) => e.site === name)) {
    const key = sample.type;
    ent[key] = ent[key] || { tp: 0, fp: 0, fn: 0, tn: 0, errors: [] };
    const list = graph[buckets[key]] || [];
    const target = norm(sample.title);
    const found = list.some((e) => {
      const t = norm(e.title);
      return t === target || t.includes(target) || target.includes(t);
    });
    if (sample.expected) { if (found) ent[key].tp++; else { ent[key].fn++; ent[key].errors.push({ title: sample.title, reason: 'expected entity not found' }); } }
    else { if (!found) ent[key].tn++; else { ent[key].fp++; ent[key].errors.push({ title: sample.title, reason: 'rejected entity present' }); } }
  }
  return { pages: pageEval, collections: collEval, entities: ent };
}

// --- coverage accounting ----------------------------------------------------
// Per gold URL: why it is or isn't a SourceDocument — never a bare percentage.

const canonKey = (url) => {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const p = u.pathname.replace(/index\.html?$/i, '').replace(/\/+$/, '') || '/';
    return `${host}${p}`;
  } catch { return (url || '').toLowerCase(); }
};

function coverageForSite(name, docs, crawlResult) {
  const docKeys = new Set(docs.map((d) => canonKey(d.url)));
  const plan = crawlResult?.crawlPlan || [];
  const planByKey = new Map(plan.map((e) => [canonKey(e.url), e]));

  const pageStatuses = (GOLD.pages || []).filter((p) => p.site === name).map((g) => {
    const key = canonKey(g.url);
    if (docKeys.has(key)) return { url: g.url, status: 'CRAWLED' };
    // A gold URL may be covered by the root-resolution redirect chain or by a
    // page whose final URL canonicalizes to it.
    const rr = crawlResult?.rootResolution;
    if (rr && [rr.requestedUrl, ...(rr.redirectChain || []), rr.finalUrl].some((u) => u && canonKey(u) === key) &&
        rr.finalUrl && docKeys.has(canonKey(rr.finalUrl))) {
      return { url: g.url, status: 'REDIRECTED_TO_CANONICAL', finalUrl: rr.finalUrl };
    }
    const entry = planByKey.get(key);
    if (!entry) return { url: g.url, status: 'NOT_DISCOVERED' };
    if (entry.result === 'REDIRECTED_TO_CANONICAL' && entry.finalUrl && docKeys.has(canonKey(entry.finalUrl))) {
      return { url: g.url, status: 'REDIRECTED_TO_CANONICAL', finalUrl: entry.finalUrl };
    }
    return { url: g.url, status: entry.result || (entry.attempted ? 'OTHER' : 'BUDGET_EXHAUSTED'), failureReason: entry.failureReason };
  });

  const byStatus = pageStatuses.reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a; }, {});

  // Collection coverage conditioned on the parent page being crawled.
  // Gold selectorHints are semantic labels — some refer to chrome elements
  // (main-nav, breadcrumbs, social links), not doc.collections. Check the
  // artifact that actually holds the structure.
  let parentCrawled = 0, extracted = 0;
  const collectionGaps = [];
  const navNodes = (n) => (n || []).flatMap((x) => [x, ...navNodes(x.children)]);
  for (const g of (GOLD.collections || []).filter((c) => c.site === name)) {
    const parentKey = canonKey(g.docUrl);
    const doc = docs.find((d) => canonKey(d.url) === parentKey);
    if (!doc) { collectionGaps.push({ docUrl: g.docUrl, hint: g.selectorHint, reason: 'PARENT_PAGE_NOT_CRAWLED' }); continue; }
    parentCrawled++;
    const hint = (g.selectorHint || '').toLowerCase();
    let present;
    if (/nav/.test(hint)) {
      present = (navNodes(doc.chrome?.nav?.primary).length + navNodes(doc.chrome?.nav?.secondary).length) > 0 || (doc.collections || []).length > 0;
    } else if (/breadcrumb/.test(hint)) {
      present = (doc.chrome?.nav?.breadcrumbs || []).length > 0;
    } else if (/social/.test(hint)) {
      present = (doc.chrome?.contacts?.socialLinks || []).length > 0;
    } else if (/contact/.test(hint)) {
      const c = doc.chrome?.contacts || {};
      present = (c.phones?.length || 0) + (c.emails?.length || 0) + (c.addresses?.length || 0) > 0;
    } else if (/lang|theme-widget|dark|switch/.test(hint)) {
      // Utility chrome widgets — check raw DOM evidence in chrome text/links.
      const hay = `${doc.chrome?.header?.text || ''} ${(doc.chrome?.header?.links || []).map((l) => l.href).join(' ')}`.toLowerCase();
      present = /lang|theme|dark|light|en\/|\/en|flag/.test(hay) || (doc.collections || []).length > 0;
    } else {
      // Content collections: any repeated-items collection on the page.
      present = (doc.collections || []).some((c) => (c.items || []).length >= 2);
      if (!present) present = (doc.collections || []).length > 0;
    }
    if (present) extracted++;
    else collectionGaps.push({ docUrl: g.docUrl, hint: g.selectorHint, reason: 'COLLECTION_NOT_EXTRACTED' });
  }

  return {
    pages: { total: pageStatuses.length, crawled: byStatus.CRAWLED || 0, byStatus, details: pageStatuses.filter((s) => s.status !== 'CRAWLED') },
    collections: { total: (GOLD.collections || []).filter((c) => c.site === name).length, parentCrawled, extracted, gaps: collectionGaps },
  };
}

function prf(ent) {
  const p = ent.tp + ent.fp ? ent.tp / (ent.tp + ent.fp) : null;
  const r = ent.tp + ent.fn ? ent.tp / (ent.tp + ent.fn) : null;
  const f1 = p !== null && r !== null && p + r > 0 ? (2 * p * r) / (p + r) : null;
  return { precision: p, recall: r, f1 };
}

// --- main ------------------------------------------------------------------

const report = { generatedAt: new Date().toISOString(), outDir: OUT_DIR, sites: [] };
const geminiLog = path.join(OUT_DIR, 'gemini-decisions.jsonl');
fs.mkdirSync(OUT_DIR, { recursive: true });
process.env.GEMINI_SEMANTIC_LOG = geminiLog;
// Reuse an earlier run's cache when provided (cache keys are input+model+prompt
// hashes, so a replay is deterministic and free).
process.env.GEMINI_SEMANTIC_CACHE = process.env.AB_REUSE_CACHE || path.join(OUT_DIR, 'gemini-cache');

// Preflight: one cheap Gemini call before committing to a six-site run.
// If the quota is gone, stop — do not burn 100+ doomed 429 calls.
let geminiAvailable = !RULE_ONLY;
if (!RULE_ONLY) {
  try {
    const { GeminiClient } = await import('../packages/redesign-engine/dist/semantic/geminiSemanticProvider.js');
    const probe = new GeminiClient({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
    await probe.generate('Reply with exactly: {"ok": true}');
    console.log('Gemini preflight: OK');
  } catch (e) {
    console.log(`Gemini preflight FAILED — hybrid phase disabled: ${String(e.message).slice(0, 200)}`);
    geminiAvailable = false;
  }
}

for (const subject of subjects) {
  console.log(`\n=== ${subject.name.toUpperCase()} ===`);
  const siteOut = { name: subject.name, url: subject.url };
  try {
    const docs = await ensureSourceDocuments(subject);
    const rawDocs = fs.readFileSync(docs.path);
    const sourceDocuments = await loadSourceDocuments(docs.path);
    siteOut.sourceDocuments = { path: docs.path, sha256: sha256(rawDocs), reused: docs.reused, count: sourceDocuments.length };
    console.log(`  docs: ${sourceDocuments.length} (${docs.reused ? 'reused' : 'fresh crawl'}) ${docs.path} sha:${siteOut.sourceDocuments.sha256}`);

    if (docs.crawlResult) {
      siteOut.rootResolution = docs.crawlResult.rootResolution;
      siteOut.homepage = docs.crawlResult.homepage;
      siteOut.coverage = coverageForSite(subject.name, sourceDocuments, docs.crawlResult);
      console.log(`  homepage: ${docs.crawlResult.homepage?.status || 'n/a'} ${docs.crawlResult.homepage?.url || ''}`);
      console.log(`  coverage: pages ${siteOut.coverage.pages.crawled}/${siteOut.coverage.pages.total} crawled; collections ${siteOut.coverage.collections.extracted}/${siteOut.coverage.collections.parentCrawled} extracted of ${siteOut.coverage.collections.total} gold`);
    }

    // RULE-only graph
    const ruleProvider = new RuleBasedSemanticProvider();
    const ruleGraph = await buildSourceContentGraph({ sourceDocuments, baseUrl: subject.url, provider: ruleProvider });
    const rulePath = path.join(OUT_DIR, `${subject.name}-rule.json`);
    fs.writeFileSync(rulePath, JSON.stringify(ruleGraph, null, 2));

    // HYBRID graph — same source documents. With --rule-only the hybrid
    // provider is configured without a client, so every call short-circuits
    // to the rule result without touching the network or quota.
    const hybridProvider = !geminiAvailable
      ? (() => { const k = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY; const p = new HybridGeminiProvider({}); if (k) process.env.GEMINI_API_KEY = k; return p; })()
      : new HybridGeminiProvider({});
    const hybridGraph = await buildSourceContentGraph({ sourceDocuments, baseUrl: subject.url, provider: hybridProvider });

    // Cache proof: identical inputs + model + promptVersion → near-total reuse.
    if (CACHE_PROOF && geminiAvailable) {
      const logLen = () => (fs.existsSync(geminiLog) ? fs.readFileSync(geminiLog, 'utf8').trim().split('\n').length : 0);
      const before = logLen();
      const again = new HybridGeminiProvider({});
      await buildSourceContentGraph({ sourceDocuments, baseUrl: subject.url, provider: again });
      const after = logLen();
      const secondRunLines = fs.existsSync(geminiLog) ? fs.readFileSync(geminiLog, 'utf8').trim().split('\n').slice(before).map((l) => JSON.parse(l)) : [];
      siteOut.cacheProof = { secondRunCalls: after - before, secondRunRealCalls: secondRunLines.filter((l) => !l.cached).length, secondRunCacheHits: secondRunLines.filter((l) => l.cached).length };
      console.log(`  cache proof: second run ${siteOut.cacheProof.secondRunRealCalls} real calls / ${siteOut.cacheProof.secondRunCacheHits} cache hits`);
    }
    const hybridPath = path.join(OUT_DIR, `${subject.name}-hybrid.json`);
    fs.writeFileSync(hybridPath, JSON.stringify(hybridGraph, null, 2));

    siteOut.ruleGraph = { path: rulePath, sha256: sha256(fs.readFileSync(rulePath)) };
    siteOut.hybridGraph = { path: hybridPath, sha256: sha256(fs.readFileSync(hybridPath)) };

    siteOut.rule = evaluateSite(subject.name, sourceDocuments, ruleGraph);
    siteOut.hybrid = evaluateSite(subject.name, sourceDocuments, hybridGraph);

    // Override table: per-page / per-collection diffs between the two graphs.
    const overrides = [];
    const rulePages = new Map(ruleGraph.pages.map((p) => [p.sourceDocumentId, p]));
    const hybridPages = new Map(hybridGraph.pages.map((p) => [p.sourceDocumentId, p]));
    const goldPageByUrl = new Map((GOLD.pages || []).filter((g) => g.site === subject.name).map((g) => [canonicalUrl(g.url), g.expected]));
    for (const [docId, hp] of hybridPages) {
      const rp = rulePages.get(docId);
      const doc = sourceDocuments.find((d) => d.id === docId);
      if (!rp || !doc) continue;
      if (rp.classification.type !== hp.classification.type) {
        const goldExpected = goldPageByUrl.get(canonicalUrl(doc.url));
        overrides.push({ kind: 'page', url: doc.url, rule: rp.classification.type, ruleConf: rp.classification.confidence, gemini: hp.classification.type, geminiConf: hp.classification.confidence, gold: goldExpected });
      }
      const ruleColls = new Map(rp.collections.map((c) => [c.collectionId, c]));
      for (const hc of hp.collections) {
        const rc = ruleColls.get(hc.collectionId);
        if (!rc) continue;
        const rLabel = `${rc.type}/${rc.contentSubtype || ''}`;
        const hLabel = `${hc.type}/${hc.contentSubtype || ''}`;
        if (rLabel !== hLabel) {
          overrides.push({ kind: 'collection', url: doc.url, collectionId: hc.collectionId, rule: rLabel, ruleConf: rc.confidence, gemini: hLabel, geminiConf: hc.confidence });
        }
      }
    }
    siteOut.overrides = overrides;

    // Facts for manual audit.
    siteOut.factsAudit = {
      rule: { company: ruleGraph.company, contacts: ruleGraph.contacts, facts: ruleGraph.facts, rejected: ruleGraph.rejectedFacts || [] },
      hybrid: { company: hybridGraph.company, contacts: hybridGraph.contacts, facts: hybridGraph.facts, rejected: hybridGraph.rejectedFacts || [] },
    };

    console.log(`  rule: pages ${siteOut.rule.pages.correct}/${siteOut.rule.pages.correct + siteOut.rule.pages.wrong} colls ${siteOut.rule.collections.correct}/${siteOut.rule.collections.correct + siteOut.rule.collections.wrong}`);
    console.log(`  hybrid: pages ${siteOut.hybrid.pages.correct}/${siteOut.hybrid.pages.correct + siteOut.hybrid.pages.wrong} colls ${siteOut.hybrid.collections.correct}/${siteOut.hybrid.collections.correct + siteOut.hybrid.collections.wrong} | overrides: ${overrides.length}`);
    report.sites.push(siteOut);
  } catch (err) {
    console.log(`  FAILED: ${err.message}`);
    report.sites.push({ ...siteOut, error: err.message });
  }
}

// Gemini call stats from the decision log.
try {
  const lines = fs.readFileSync(geminiLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const durations = lines.map((l) => l.durationMs).filter((d) => typeof d === 'number').sort((a, b) => a - b);
  report.geminiStats = {
    calls: lines.filter((l) => !l.cached).length,
    cacheHits: lines.filter((l) => l.cached).length,
    errors: lines.filter((l) => l.error).length,
    avgLatencyMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    p95LatencyMs: durations.length ? durations[Math.floor(durations.length * 0.95)] : 0,
    byCallType: lines.reduce((acc, l) => { acc[l.callType] = (acc[l.callType] || 0) + 1; return acc; }, {}),
  };
} catch { report.geminiStats = { calls: 0 }; }

const outJson = path.join(OUT_DIR, 'ab-report.json');
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
console.log(`\nReport: ${outJson}`);
console.log(`Gemini stats: ${JSON.stringify(report.geminiStats)}`);
