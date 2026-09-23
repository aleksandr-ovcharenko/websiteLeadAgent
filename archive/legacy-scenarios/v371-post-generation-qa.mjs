// V3.7.1 Phase 11 — reusable post-generation QA loop.
//
// Classifies every failure by owning pipeline stage so repairs rerun ONLY the
// affected stage:
//   extraction bug  → rerun extraction from the existing crawl snapshot
//   semantic bug    → rebuild graph/import from the snapshot
//   template bug    → rerender without recrawl
//   missing source  → targeted recrawl only
//
// Usage:
//   node scripts/v371-post-generation-qa.mjs [--content <import-content.json>]
//       [--qa <generated-content-qa.json>] [--docs <source-documents.json>]
//       [--prov <graph-import-provenance.json>] [--base <renderer-base-url>]
//       [--out <report.json>] [--routes-only]
//
// Exit code 1 when any error-severity failure exists.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};

const V37 = path.join(ROOT, 'data/redesign/v37/nexttrade');
const RUN = path.join(ROOT, 'data/redesign/cmtnjmlpp003p99lgysdt7w7h/runs/cmubn42pi00018as62td6dd6s');
const CONTENT = arg('content', path.join(V37, 'import-content.json'));
const QA = arg('qa', path.join(V37, 'generated-content-qa.json'));
const DOCS = arg('docs', path.join(RUN, 'source-documents.json'));
const PROV = arg('prov', path.join(V37, 'graph-import-provenance.json'));
const BASE = arg('base', 'http://localhost:3336/showcase/mubop32v09uy');
const OUT = arg('out', path.join(ROOT, 'data/redesign/v371/post-generation-qa.json'));
const ROUTES_ONLY = process.argv.includes('--routes-only');

const failures = [];
const push = (f) => failures.push({ requiresRecrawl: false, severity: 'error', ...f });

const load = async (p) => JSON.parse(await readFile(p, 'utf8').then((s) => s, () => null));

const content = await load(CONTENT);
const qa = await load(QA);
const docsRaw = await load(DOCS);
const prov = await load(PROV);
const docs = Array.isArray(docsRaw) ? docsRaw : docsRaw?.documents || [];

// ── Stage 1: extraction findings (technical drops are expected diagnostics;
// a technical payload that reached visible content is the failure) ──────────
if (qa) {
  for (const f of qa.findings || []) {
    push({ ...f, source: 'generated-content-qa' });
  }
}

// ── Stage 2: route integrity — every declared entity route must resolve ────
const entities = [];
for (const [key, kind] of [['pages', 'page'], ['services', 'service'], ['projects', 'project'], ['news', 'news'], ['products', 'product'], ['vacancies', 'vacancy']]) {
  for (const e of content?.[key] || []) {
    if (e.slug) entities.push({ kind, slug: e.slug, title: e.title });
  }
}

const checked = [];
for (const e of entities) {
  const url = `${BASE}/${e.slug.replace(/^\//, '')}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    checked.push({ route: url, status: res.status });
    if (res.status !== 200) {
      push({
        stage: 'template', kind: 'route-not-found', entityId: e.slug,
        route: url, severity: 'error',
        message: `${e.kind} route returned HTTP ${res.status}`,
        evidence: `${e.title || e.slug} → ${res.status}`,
        suggestedOwner: 'template', source: 'route-integrity',
      });
    }
  } catch (err) {
    push({
      stage: 'template', kind: 'route-error', entityId: e.slug, route: url,
      severity: 'error', message: `fetch failed: ${err.message}`,
      evidence: String(err), suggestedOwner: 'template', source: 'route-integrity',
    });
  }
}

// ── Stage 3: extraction-side diagnostics passthrough ───────────────────────
const technicalDrops = [];
for (const d of docs) {
  for (const t of d.diagnostics?.technicalPayloads || []) {
    technicalDrops.push({ sourceUrl: d.url, path: d.path, ...t });
  }
}

// ── Stage 4: media suitability summary ─────────────────────────────────────
const media = prov?.media || [];
const mediaSummary = {
  total: media.length,
  suitable: media.filter((m) => m.suitable).length,
  rejected: media.filter((m) => !m.suitable).length,
  byReason: {},
};
for (const m of media.filter((m) => !m.suitable)) {
  for (const r of m.reasons || ['unspecified']) {
    mediaSummary.byReason[r] = (mediaSummary.byReason[r] || 0) + 1;
  }
}

const errors = failures.filter((f) => f.severity === 'error');
const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  stages: ['extraction', 'semantic', 'generation', 'import', 'template', 'media', 'render'],
  summary: {
    entitiesChecked: entities.length,
    routesChecked: checked.length,
    routesOk: checked.filter((c) => c.status === 200).length,
    technicalDropsAtExtraction: technicalDrops.length,
    media: mediaSummary,
    failures: failures.length,
    errors: errors.length,
    warnings: failures.filter((f) => f.severity === 'warning').length,
  },
  technicalDrops,
  failures,
  requiresRecrawl: failures.filter((f) => f.requiresRecrawl).map((f) => f.entityId),
};

await writeFile(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (errors.length && !ROUTES_ONLY) {
  console.log('ERRORS:');
  for (const f of errors.slice(0, 30)) console.log(` - [${f.stage}/${f.kind}] ${f.entityId}: ${f.message}`);
}
process.exit(errors.length ? 1 : 0);
