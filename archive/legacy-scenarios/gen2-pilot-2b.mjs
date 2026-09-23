// Generation V2 Phase 2B-A — 10-site COLD pilot.
// Per site: fresh crawl → SourceDocuments → SourceContentGraph →
// SiteContentPlan + human-review report. Stops at the review checkpoint:
// no CMS mutation, no Showcase generation.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { crawlSite } from '../packages/redesign-engine/dist/crawl/crawlSite.js';
import { buildSourceDocuments } from '../packages/redesign-engine/dist/extract/buildSourceDocuments.js';
import { buildSourceContentGraph } from '../packages/redesign-engine/dist/semantic/graph.js';
import { HybridGeminiProvider, GeminiClient } from '../packages/redesign-engine/dist/semantic/geminiSemanticProvider.js';
import { buildSiteContentPlan } from '../packages/redesign-engine/dist/plan/siteContentPlan.js';
import { buildPlanReport } from '../packages/redesign-engine/dist/plan/planReport.js';

const PILOT_DIR = 'data/redesign/pilot-2b';
const sha256 = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

const PRIMARY = [
  ['masterstroy', 'https://masterstroy.by/'],
  ['dom-minsk', 'https://dom-minsk.by/'],
  ['puzzlehouse', 'https://puzzlehouse.by/'],
  ['lishen', 'https://lishen.by/'],
  ['darol', 'https://darol.by/'],
  ['home', 'https://home.by/'],
  ['zolen', 'https://zolen.by/'],
  ['komanda-m', 'https://komanda-m.by/'],
  ['sdke', 'https://sdke.by/'],
  ['proff-remont', 'https://proff-remont.by/'],
];
const BACKUPS = [
  ['dompodkluch', 'https://dompodkluch.by/'],
  ['1000proektov', 'https://1000proektov.by/'],
];

// Cold-run: fresh namespace, fresh Gemini cache — nothing is reused.
fs.rmSync(PILOT_DIR, { recursive: true, force: true });
fs.mkdirSync(PILOT_DIR, { recursive: true });
const geminiLog = path.join(PILOT_DIR, 'gemini-decisions.jsonl');
process.env.GEMINI_SEMANTIC_LOG = geminiLog;
process.env.GEMINI_SEMANTIC_CACHE = path.join(PILOT_DIR, 'gemini-cache');

// Preflight: if quota is dead, run rule-only — the circuit breaker keeps us safe.
let geminiAvailable = true;
try {
  const probe = new GeminiClient({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
  await probe.generate('Reply with exactly: {"ok": true}');
  console.log('Gemini preflight: OK');
} catch (e) {
  console.log(`Gemini preflight FAILED — proceeding with rule-only semantics: ${String(e.message).slice(0, 120)}`);
  geminiAvailable = false;
}

const cacheHitsFor = (site) => {
  if (!fs.existsSync(geminiLog)) return 0;
  return fs.readFileSync(geminiLog, 'utf8').trim().split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).filter((l) => l.cached).length;
};

const summary = [];
let sitesDone = 0;
for (const [key, url] of [...PRIMARY, ...BACKUPS]) {
  if (sitesDone >= 10) break;
  const siteDir = path.join(PILOT_DIR, key);
  fs.mkdirSync(siteDir, { recursive: true });
  console.log(`\n=== ${key} ${url} ===`);
  const cold = { crawlCacheHit: false, sourceDocumentReuse: false, semanticCacheHits: 0, generationPlanReuse: false };
  try {
    const crawl = await crawlSite({ baseUrl: url, maxPages: 40, maxDepth: 3, timeoutMs: 30000, rootTimeoutMs: 45000, rootRetries: 1 });
    if (!crawl.pages.length) { console.log('  no pages — site unavailable'); continue; }
    fs.writeFileSync(path.join(siteDir, 'crawl.json'), JSON.stringify({ baseUrl: url, rootResolution: crawl.rootResolution, homepage: crawl.homepage, warnings: crawl.warnings, skipped: crawl.skipped, crawlPlan: crawl.crawlPlan, pages: crawl.pages.length, navigation: crawl.navigation }, null, 2));
    fs.writeFileSync(path.join(siteDir, 'crawl-full.json'), JSON.stringify(crawl, null, 2));

    const docs = buildSourceDocuments(crawl);
    fs.writeFileSync(path.join(siteDir, 'source-documents.json'), JSON.stringify(docs, null, 2));

    const hitsBefore = cacheHitsFor(key);
    const provider = geminiAvailable ? new HybridGeminiProvider({}) : (() => { const k = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY; const p = new HybridGeminiProvider({}); if (k) process.env.GEMINI_API_KEY = k; return p; })();
    const graph = await buildSourceContentGraph({ sourceDocuments: docs, baseUrl: url, provider });
    cold.semanticCacheHits = cacheHitsFor(key) - hitsBefore;
    const graphPath = path.join(siteDir, 'source-content-graph.json');
    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));

    const plan = buildSiteContentPlan({ siteKey: key, baseUrl: url, graph, documents: docs, sourceGraphHash: sha256(fs.readFileSync(graphPath)) });
    fs.writeFileSync(path.join(siteDir, 'site-content-plan.json'), JSON.stringify(plan, null, 2));
    fs.writeFileSync(path.join(siteDir, 'site-content-plan-report.md'), buildPlanReport(plan, graph, docs));

    console.log(`  pages ${docs.length} | home ${plan.homepage ? 'ok' : 'no'} | S:${plan.services.length} P:${plan.projects.length} Pr:${plan.products.length} N:${plan.news.length} | ${plan.readiness} | cacheHits ${cold.semanticCacheHits}`);
    summary.push({ key, url, pages: docs.length, services: plan.services.length, projects: plan.projects.length, products: plan.products.length, news: plan.news.length, dynamic: plan.dynamicSections.length, homeSections: plan.homepage.plannedSections.length, warnings: plan.warnings.length, readiness: plan.readiness, ...cold });
    sitesDone++;
  } catch (e) {
    console.log(`  FAILED: ${e.message}`);
    summary.push({ key, url, error: e.message, ...cold });
  }
}

// Cross-site summary.
const md = ['# Pilot 2B-A — 10-site cold generation-input pilot', '',
  `Generated: ${new Date().toISOString()} — cold run (no crawl/doc/cache reuse)`, '',
  '| site | pages | services | projects | products | news | dyn. sections | home sections | warnings | readiness | cacheHits |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...summary.map((s) => s.error
    ? `| ${s.key} | ERROR | — | — | — | — | — | — | — | FAILED | 0 |`
    : `| ${s.key} | ${s.pages} | ${s.services} | ${s.projects} | ${s.products} | ${s.news} | ${s.dynamic} | ${s.homeSections} | ${s.warnings} | ${s.readiness} | ${s.semanticCacheHits} |`),
].join('\n') + '\n';
fs.writeFileSync(path.join(PILOT_DIR, 'PILOT-SUMMARY.md'), md);
fs.writeFileSync(path.join(PILOT_DIR, 'pilot-summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), geminiAvailable, sites: summary }, null, 2));
console.log(`\nSummary: ${PILOT_DIR}/PILOT-SUMMARY.md`);
console.log(`Sites processed: ${sitesDone}/10`);
