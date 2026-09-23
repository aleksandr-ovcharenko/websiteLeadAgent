import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { crawlSite } from '../crawl/crawlSite.js';
import { buildSourceDocuments, sourceDocumentToCrawledPage } from '../extract/buildSourceDocuments.js';
import { extractFromCrawl } from '../extract/extractFromCrawl.js';
import { graphToImportContent } from '../import/graphToImportContent.js';
import type { GraphImportProvenance } from '../import/graphToImportContent.js';
import { runGeneratedContentQa } from '../qa/generatedContentQa.js';
import { runRouteIntegrity } from '../qa/routeIntegrity.js';
import { auditEntityDuplicates, normalizeEntityContent } from '../qa/duplicateContent.js';
import { runPostRenderQa, pickQaRoutes, buildRouteManifest } from '../qa/postRenderQa.js';
import { runVisualQa } from '../qa/visualQa.js';
import { importToCms } from '../import/importToCms.js';
import { validateGeneratedSite } from './validateSite.js';
import { buildSourceContentGraph } from '../semantic/graph.js';
import { ensureDependencySnapshot, linkSiteBuildSnapshot } from '../security/snapshot.js';
import { gateResult, STAGE_TO_RUN_STAGE, STAGE_ORDER } from './stageContract.js';
import { createPrismaRevisionStore, type RevisionStore } from './revisions.js';
import { publishForgePreview } from './forgePreview.js';
import { loadRunForResume, mergeStageResult, resolveActiveVariant, resolveCanonicalSite } from './resume.js';
import { createHash } from 'node:crypto';
import type { PipelineStage, StageGateResult } from './stageContract.js';
import type { CrawlResult } from '../types.js';
import type { ExtractedContent } from '../../../content-schema/dist/index.js';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-]/gu, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

type ActivityPayload = { module: string; eventType: string; message: string; details?: Record<string, any>; level?: 'INFO' | 'WARN' | 'ERROR' };
export type ActivityHandler = (p: ActivityPayload) => Promise<void>;

export interface GenerateOptions {
  leadId: string;
  templateId?: string;
  force?: boolean;
  /** retry: re-run technical stages without replacing unrelated CMS content; regenerate: replace generated content owned by previous runs */
  mode?: 'retry' | 'regenerate' | 'reset';
  crawlRunId?: string;
  /** When true, build source-documents.json and source-content-graph.json and stop before legacy extraction/CMS import (Phase 2A shadow mode). */
  semanticOnly?: boolean;
  /** Compatibility fallback for tests only: source the CMS import contract from
   *  legacy extractFromCrawl instead of the SourceContentGraph. Canonical
   *  generation must leave this unset. */
  useLegacyExtraction?: boolean;
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
  prisma?: PrismaClient;
  onActivity?: ActivityHandler;
  /** Explicit test mode: produces a site marked as fixture (hidden from Forge). */
  fixture?: boolean;
  fixtureOwner?: string;
  /** V3.7.2: resume the run from a stage using stored artifacts — stages
   *  before it are re-derived from the crawl artifact but not re-gated for
   *  network work. 'RENDER_VALIDATED' re-runs only the post-render gate. */
  resumeFromStage?: PipelineStage;
  /** Base URL of the site renderer for the post-render QA gate
   *  (default env.RENDER_QA_BASE_URL or http://localhost:3336). */
  renderQaBaseUrl?: string;
  /** Run the browser tier of post-render QA (default true). */
  renderQaBrowser?: boolean;
  /** V3.7.4 Phase 7 — per-stage timeout budget (default 10 min). A stage that
   *  exceeds it fails the revision with an explicit timeout reason. */
  stageTimeoutMs?: number;
}

export interface RunCrawlOptions {
  leadId: string;
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
  force?: boolean;
  prisma?: PrismaClient;
  onActivity?: ActivityHandler;
}

export async function runCrawl(options: RunCrawlOptions) {
  const prisma = options.prisma ?? new PrismaClient();
  const onActivity = options.onActivity;
  const emit = async (level: 'INFO' | 'WARN' | 'ERROR', eventType: string, message: string, details?: Record<string, any>) => {
    if (onActivity) {
      try { await onActivity({ module: 'FACTORY', eventType, message, details, level }); } catch { /* no-op */ }
    }
  };

  const l = await (prisma as any).lead.findUnique({
    where: { id: options.leadId },
    include: { site: true }
  });
  if (!l) throw new Error(`Lead not found: ${options.leadId}`);

  if (l.manualReviewStatus !== 'GOOD') {
    throw new Error(`Lead ${l.id} is not GOOD (status: ${l.manualReviewStatus})`);
  }

  const baseUrl = l.website;
  if (!baseUrl) throw new Error(`Lead has no website: ${l.id}`);

  // A run is "in progress" only while it is provably alive: a heartbeat row
  // fresher than a few beat intervals, or a brand-new run whose first beat
  // has not landed yet. Anything older is a crashed/zombie run — it must not
  // block a retry forever.
  const ACTIVE_STALE_MS = 90_000;
  const aliveCutoff = new Date(Date.now() - ACTIVE_STALE_MS);
  const activeRun = await (prisma as any).redesignRun.findFirst({
    where: {
      leadId: l.id,
      stage: { notIn: ['CRAWL_FAILED', 'DEMO_GENERATED', 'HUMAN_REVIEW_READY', 'DEMO_APPROVED', 'READY_TO_CONTACT'] },
      errorMessage: null,
      OR: [
        { lastHeartbeatAt: { gte: aliveCutoff } },
        { lastHeartbeatAt: null, createdAt: { gte: aliveCutoff } },
      ],
    },
    orderBy: { createdAt: 'desc' }
  });
  if (!options.force && activeRun) {
    throw new Error(`Crawl or generation already in progress for lead ${l.id} (run ${activeRun.id}). Use force to start a new run.`);
  }

  const run = await (prisma as any).redesignRun.create({
    data: {
      leadId: l.id,
      stage: 'SELECTED_FOR_REDESIGN'
    }
  });

  await (prisma as any).lead.update({
    where: { id: l.id },
    data: { redesignStage: 'SELECTED_FOR_REDESIGN' }
  });

  const artifactDir = join('data', 'redesign', l.id, 'runs', run.id);
  await mkdir(artifactDir, { recursive: true });

  // Liveness heartbeat for the crawl phase — generateSite heartbeats the
  // same run through the later stages; a standalone CRAWL_SITE call must not
  // go silent or a long crawl would look like a zombie to the guard above.
  const crawlHeartbeat = setInterval(() => {
    (prisma as any).redesignRun.update({ where: { id: run.id }, data: { lastHeartbeatAt: new Date() } }).catch(() => undefined);
  }, 15000);
  crawlHeartbeat.unref?.();

  try {
    await emit('INFO', 'FACTORY_CRAWL_STARTED', 'Crawling source website', { baseUrl, runId: run.id });
    const crawlResult = await crawlSite({
      baseUrl,
      maxPages: options.maxPages ?? 40,
      maxDepth: options.maxDepth ?? 4,
      timeoutMs: options.timeoutMs ?? 30000
    });

    const crawlJsonPath = join(artifactDir, 'crawl.json');
    const crawlArtifact = {
      meta: {
        runId: run.id,
        leadId: l.id,
        startUrl: baseUrl,
        startedAt: new Date().toISOString(),
        maxPages: options.maxPages ?? 40,
        maxDepth: options.maxDepth ?? 4,
        timeoutMs: options.timeoutMs ?? 30000
      },
      homepage: crawlResult.homepage,
      warnings: crawlResult.warnings,
      skipped: crawlResult.skipped,
      pages: crawlResult.pages,
      navigation: crawlResult.navigation
    };
    await writeFile(crawlJsonPath, JSON.stringify(crawlArtifact, null, 2));

    await emit('INFO', 'FACTORY_CRAWL_COMPLETED', `Crawled ${crawlResult.pages.length} pages`, { pages: crawlResult.pages.length, homepage: crawlResult.homepage });

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: {
        crawlJsonPath,
        homepageCandidate: crawlResult.homepage as any,
        currentCrawl: { homepage: crawlResult.homepage, pageCount: crawlResult.pages.length, warnings: crawlResult.warnings } as any,
        stage: 'CRAWL_READY'
      }
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CRAWL_READY' }
    });

    return { run, crawlResult, crawlJsonPath };
  } catch (err: any) {
    await emit('ERROR', 'FACTORY_CRAWL_FAILED', `Crawl failed: ${err?.message || String(err)}`, { error: err?.message || String(err) });
    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { errorMessage: err?.message || String(err), stage: 'CRAWL_FAILED' }
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CRAWL_FAILED' }
    });
    throw err;
  } finally {
    clearInterval(crawlHeartbeat);
  }
}

export async function generateSite(options: GenerateOptions) {
  const prisma = options.prisma ?? new PrismaClient();
  const templateId = options.templateId ?? 'construction-modern-v1';
  const mode = options.mode ?? 'retry';
  const regenerateContent = mode !== 'retry';
  const onActivity = options.onActivity;
  const emit = async (level: 'INFO' | 'WARN' | 'ERROR', eventType: string, message: string, details?: Record<string, any>) => {
    if (onActivity) {
      try { await onActivity({ module: 'FACTORY', eventType, message, details, level }); } catch { /* no-op */ }
    }
  };

  const l = await (prisma as any).lead.findUnique({
    where: { id: options.leadId },
    include: { site: true }
  });
  if (!l) throw new Error(`Lead not found: ${options.leadId}`);

  await emit('INFO', 'FACTORY_STARTED', 'Starting site generation', { leadId: l.id });

  // V3.7.4 Phase 7 — liveness heartbeat. The HTTP caller may have long gone;
  // this proves the job is alive and lets a retry distinguish "crashed" from
  // "in progress" instead of starting a replacement run.
  const heartbeat = setInterval(() => {
    (prisma as any).redesignRun.update({ where: { id: run?.id }, data: { lastHeartbeatAt: new Date() } }).catch(() => undefined);
  }, 15000);
  heartbeat.unref?.();

  if (l.manualReviewStatus !== 'GOOD' && !options.fixture) {
    throw new Error(`Lead ${l.id} is not GOOD (status: ${l.manualReviewStatus})`);
  }

  // Generation gate: a customer-facing site is impossible without a real
  // source URL + crawl artifact. Fixture mode must be explicit.
  if (!options.fixture) {
    if (!l.website || !/^https?:\/\//.test(l.website)) {
      throw new Error(`Lead ${l.id} has no valid website — refusing to generate a customer site without a source URL`);
    }
  }

  let run: any;
  let crawlResult: CrawlResult;
  let crawlJsonPath: string;

  if (options.crawlRunId) {
    const rr = await loadRunForResume(prisma, options.crawlRunId, l.id, options.force);
    crawlJsonPath = rr.crawlJsonPath;
    crawlResult = rr.crawlResult as CrawlResult;
    run = rr.run;
  } else {
    // Backward compatibility: crawl now and continue.
    const cr = await runCrawl({
      leadId: options.leadId,
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      timeoutMs: options.timeoutMs,
      force: options.force,
      prisma: options.prisma,
      onActivity: options.onActivity
    });
    run = cr.run;
    crawlResult = cr.crawlResult;
    crawlJsonPath = cr.crawlJsonPath;
  }

  // Do NOT delete the existing Site. The canonical Site must survive retries.
  // Force now means "regenerate imported/generated content while preserving Site.id".
  // The lead's own site link can point at an ARCHIVED row after a canonical
  // merge — resolve the canonical site by domain, same rule as importToCms.
  const existingSite = await resolveCanonicalSite(prisma, l);
  const baseUrl = crawlResult.homepage?.url || l.website;
  const artifactDir = dirname(crawlJsonPath);

  // V3.7.2 — gated stage machine. Every stage emits a typed StageGateResult,
  // persists it on the run, and blocks progression on FAIL.
  // Resume reuses the run row — preserve prior gate history so the audit
  // trail covers the whole run, and overwrite same-stage entries on re-run.
  const stageResults: StageGateResult[] = Array.isArray(run.stageResults)
    ? [...(run.stageResults as StageGateResult[])]
    : [];
  const resumeIdx = options.resumeFromStage ? STAGE_ORDER.indexOf(options.resumeFromStage) : 0;
  const gated = (stage: PipelineStage) => STAGE_ORDER.indexOf(stage) >= resumeIdx;
  // V3.7.4 Phase 2 — revision lifecycle. Created after CMS_IMPORTED once the
  // (siteId, variantId) pair is known; every gate checkpoints onto it; a gate
  // failure marks the revision QA_FAILED without touching the variant's
  // activeRevisionId; final promotion to REVIEW_READY is atomic and requires
  // DB-backed screenshots for the route manifest.
  let revisionStore: RevisionStore | undefined;
  let revisionId: string | undefined;
  let revisionRoutes: string[] = [];
  // V3.7.4 Phase 7 — per-stage timeout. Two enforcement points:
  //  (a) gate boundary — a completed stage over budget is converted to FAIL;
  //  (b) watchdog — a stage that never reaches its gate still fails the
  //      revision with an explicit timeout reason, and any later gate
  //      recording aborts the run so the stale process cannot continue.
  const stageTimeoutMs = options.stageTimeoutMs ?? 10 * 60 * 1000;
  let lastGateAt = Date.now();
  let lastGateStage: PipelineStage | null = null;
  let timedOut = false;
  const stageWatchdog = setInterval(() => {
    if (timedOut || !revisionId) return;
    if (Date.now() - lastGateAt > stageTimeoutMs) {
      timedOut = true;
      const reason = `stage timeout: no gate completed within ${Math.round(stageTimeoutMs / 1000)}s (stalled after ${lastGateStage ?? 'pipeline start'})`;
      revisionStore?.fail(revisionId, reason, lastGateStage as any).catch(() => undefined);
      (prisma as any).redesignRun.update({ where: { id: run?.id }, data: { errorMessage: reason } }).catch(() => undefined);
      emit('ERROR', 'FACTORY_STAGE_TIMEOUT', reason, { stage: lastGateStage }).catch(() => undefined);
    }
  }, 15000);
  stageWatchdog.unref?.();
  const recordGate = async (r: StageGateResult) => {
    if (timedOut) {
      throw new Error(`run aborted: previous stage exceeded ${Math.round(stageTimeoutMs / 1000)}s timeout`);
    }
    if (r.status !== 'FAIL' && typeof r.durationMs === 'number' && r.durationMs > stageTimeoutMs) {
      r = { ...r, status: 'FAIL', errors: [...r.errors, `stage timeout: ${r.stage} took ${Math.round(r.durationMs / 1000)}s (budget ${Math.round(stageTimeoutMs / 1000)}s)`] };
    }
    mergeStageResult(stageResults, r);
    if (revisionStore && revisionId) {
      await revisionStore.checkpoint(revisionId, r.stage, r.durationMs).catch(() => undefined);
    }
    await emit(
      r.status === 'FAIL' ? 'ERROR' : r.status === 'PASS_WITH_WARNINGS' ? 'WARN' : 'INFO',
      `FACTORY_GATE_${r.stage}`,
      `${r.stage}: ${r.status}${r.errors.length ? ` — ${r.errors[0]}` : ''}`,
      { status: r.status, errors: r.errors, warnings: r.warnings, metrics: r.metrics, artifactPaths: r.artifactPaths, retryFromStage: r.retryFromStage, durationMs: r.durationMs },
    );
    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: {
        stageResults: stageResults as any,
        ...(r.status !== 'FAIL' ? { stage: STAGE_TO_RUN_STAGE[r.stage] as any } : {}),
      },
    });
    if (r.status !== 'FAIL') {
      await (prisma as any).lead.update({
        where: { id: l.id },
        data: { redesignStage: STAGE_TO_RUN_STAGE[r.stage] as any },
      });
    }
    lastGateAt = Date.now();
    lastGateStage = r.stage;
  };

  try {
    const crawled = crawlResult.pages;
    const navigation = crawlResult.navigation;

    // ---- CRAWLED (gate recorded when resuming from a stored artifact) ------
    await recordGate(gateResult('CRAWLED', {
      metrics: { pages: crawled.length, warnings: crawlResult.warnings?.length ?? 0, resumed: !!options.crawlRunId },
      artifactPaths: [crawlJsonPath],
    }));

    // ---- EXTRACTED: crawl → SourceDocuments (technical payloads dropped here)
    let t0 = Date.now();
    const sourceDocuments = buildSourceDocuments(crawlResult);
    const sourceDocumentsJsonPath = join(artifactDir, 'source-documents.json');
    await writeFile(sourceDocumentsJsonPath, JSON.stringify(sourceDocuments, null, 2));
    const technicalDrops = sourceDocuments.reduce((n, d) => n + ((d as any).diagnostics?.technicalPayloads?.length || 0), 0);
    if (gated('EXTRACTED')) {
      const r = gateResult('EXTRACTED', {
        errors: sourceDocuments.length ? [] : ['crawl produced zero source documents'],
        metrics: { documents: sourceDocuments.length, technicalPayloadsRemoved: technicalDrops },
        artifactPaths: [sourceDocumentsJsonPath], startedAt: t0,
      });
      await recordGate(r);
      if (r.status === 'FAIL') throw new Error(`Gate EXTRACTED failed: ${r.errors[0]}`);
    }

    // ---- CONTENT_VALIDATED: source documents sanity ------------------------
    t0 = Date.now();
    if (gated('CONTENT_VALIDATED')) {
      // A real homepage document is required — it is the structural source of
      // the homepage Page and its editable hero. Falling back to an arbitrary
      // crawled page would fabricate homepage chrome with no CMS ownership,
      // which downstream editability gates are designed to reject.
      const homeDoc = sourceDocuments.find((d) => d.isHomepage);
      const errors: string[] = [];
      if (!homeDoc) {
        errors.push(
          crawlResult.homepage?.status === 'FOUND'
            ? 'resolved homepage was not crawled — no homepage source document'
            : 'no homepage source document',
        );
      } else if (!((homeDoc as any).sections?.length || (homeDoc as any).h1)) {
        errors.push('homepage source document has no content sections');
      }
      const r = gateResult('CONTENT_VALIDATED', {
        errors,
        warnings: sourceDocuments.filter((d) => !(d as any).sections?.length).map((d) => `document ${d.id} has no sections`).slice(0, 20),
        metrics: { documents: sourceDocuments.length }, startedAt: t0,
      });
      await recordGate(r);
      if (r.status === 'FAIL') throw new Error(`Gate CONTENT_VALIDATED failed: ${r.errors[0]}`);
    }

    // ---- GRAPH_BUILT --------------------------------------------------------
    t0 = Date.now();
    const sourceContentGraph = await buildSourceContentGraph({ sourceDocuments, baseUrl });
    const sourceContentGraphPath = join(artifactDir, 'source-content-graph.json');
    await writeFile(sourceContentGraphPath, JSON.stringify(sourceContentGraph, null, 2));
    await emit('INFO', 'FACTORY_SEMANTIC_GRAPH_BUILT', `Semantic graph built (${sourceContentGraph.pages.length} pages, ${sourceContentGraph.services.length} services, ${sourceContentGraph.projects.length} projects, ${sourceContentGraph.news.length} news)`, { sourceContentGraphPath, pages: sourceContentGraph.pages.length, services: sourceContentGraph.services.length, projects: sourceContentGraph.projects.length, news: sourceContentGraph.news.length, warnings: sourceContentGraph.warnings.length });
    if (gated('GRAPH_BUILT')) {
      const r = gateResult('GRAPH_BUILT', {
        metrics: {
          pages: sourceContentGraph.pages.length, services: sourceContentGraph.services.length,
          projects: sourceContentGraph.projects.length, news: sourceContentGraph.news.length,
          graphWarnings: sourceContentGraph.warnings.length,
        },
        artifactPaths: [sourceContentGraphPath], startedAt: t0,
      });
      await recordGate(r);
      if (r.status === 'FAIL') throw new Error(`Gate GRAPH_BUILT failed: ${r.errors[0]}`);
    }

    if (options.semanticOnly) {
      await (prisma as any).redesignRun.update({
        where: { id: run.id },
        data: { currentCrawl: { homepage: crawlResult.homepage, pageCount: crawled.length, warnings: crawlResult.warnings, sourceContentGraphPath, sourceDocumentsJsonPath } as any, stage: 'CONTENT_EXTRACTED' }
      });
      return { leadId: l.id, runId: run.id, sourceDocumentsJsonPath, sourceContentGraphPath, sourceContentGraph, stageResults };
    }

    // ---- CMS_IMPORT_READY: contract + content QA + route integrity ---------
    // CANONICAL (V3.6): the CMS import contract is derived from the
    // SourceContentGraph — not from legacy extractFromCrawl.
    t0 = Date.now();
    const primaryNav = sourceDocuments.find((d) => d.isHomepage)?.chrome.nav?.primary
      || sourceDocuments[0]?.chrome.nav?.primary
      || navigation || [];
    let content: ExtractedContent;
    let graphImportProvenance: GraphImportProvenance | undefined;
    if (options.useLegacyExtraction) {
      const crawledPages = sourceDocuments.map(sourceDocumentToCrawledPage);
      content = extractFromCrawl(crawledPages, baseUrl, primaryNav);
      await emit('WARN', 'FACTORY_LEGACY_EXTRACTION', 'Legacy extractFromCrawl used (compatibility fallback — not canonical)');
    } else {
      const adapted = graphToImportContent({ graph: sourceContentGraph, sourceDocuments, baseUrl, navigation: primaryNav });
      content = adapted.content;
      graphImportProvenance = adapted.provenance;
      const provPath = join(artifactDir, 'graph-import-provenance.json');
      await writeFile(provPath, JSON.stringify(graphImportProvenance, null, 2));
      await emit('INFO', 'FACTORY_GRAPH_IMPORT_ADAPTED', `Graph→import contract built (${content.services.length} services, ${content.projects.length} projects, ${content.pages.length} pages)`, { graphImportProvenancePath: provPath, dropped: graphImportProvenance.droppedEntities.length });
    }

    const contentQa = runGeneratedContentQa(content as any, { sourceDocuments, provenance: graphImportProvenance });
    const qaPath = join(artifactDir, 'generated-content-qa.json');
    await writeFile(qaPath, JSON.stringify(contentQa, null, 2));
    await emit(
      contentQa.countsBySeverity.error ? 'WARN' : 'INFO',
      'FACTORY_CONTENT_QA',
      `GeneratedContentQA: ${contentQa.findings.length} findings (${contentQa.countsBySeverity.error} errors, ${contentQa.countsBySeverity.warning} warnings)`,
      { qaPath },
    );

    // Route contract gate: every routable entity resolves a unique route
    // through the same builders the renderer uses — before any CMS row exists.
    const routeIntegrity = runRouteIntegrity(content as any);
    const routePath = join(artifactDir, 'route-integrity.json');
    await writeFile(routePath, JSON.stringify(routeIntegrity, null, 2));

    if (gated('CMS_IMPORT_READY')) {
      const qaErrors = contentQa.findings.filter((f) => f.severity === 'error')
        .map((f) => `${f.kind} on ${f.entityId}${f.route ? ` (${f.route})` : ''}: ${f.message}`);
      // V3.7.4 Phase 6 — duplicate/semantic content gate. First normalize
      // (dedupe responsive copies, drop summary-duplicate blocks, unglue
      // headings) with a per-repair provenance log; then audit — whatever
      // remains is a blocking ERROR, never a warning.
      const dupeFindings: string[] = [];
      const dupeReport: Record<string, any> = {};
      const repairLog: Record<string, any> = {};
      const sourceByUrl = new Map<string, any>();
      for (const d of sourceDocuments || []) {
        if (d.url) sourceByUrl.set(d.url, d);
        if (d.canonicalUrl) sourceByUrl.set(d.canonicalUrl, d);
      }
      for (const [kind, list] of Object.entries({ service: content.services, project: content.projects, product: content.products, news: content.news, page: content.pages } as any)) {
        for (let i = 0; i < ((list as any[]) || []).length; i++) {
          const raw = (list as any[])[i];
          const srcPg = raw?.sourceUrl ? sourceByUrl.get(raw.sourceUrl) : null;
          const { entity, repairs } = normalizeEntityContent({ ...raw, metaDescription: srcPg?.metaDescription });
          (list as any[])[i] = entity;
          if (repairs.length) repairLog[`${kind}:${entity.slug || entity.title}`] = repairs;
          const findings = auditEntityDuplicates(entity);
          if (findings.length) {
            dupeReport[`${kind}:${entity.slug || entity.title}`] = findings;
            for (const f of findings) {
              dupeFindings.push(`${f.kind} on ${kind} ${entity.slug || entity.title}: "${f.text}" ×${f.occurrences}`);
            }
          }
        }
      }
      await writeFile(join(artifactDir, 'duplicate-content.json'), JSON.stringify({ repairs: repairLog, remaining: dupeReport }, null, 2));
      const r = gateResult('CMS_IMPORT_READY', {
        errors: [...qaErrors, ...routeIntegrity.errors, ...dupeFindings],
        warnings: [
          ...contentQa.findings.filter((f) => f.severity === 'warning').map((f) => `${f.kind}: ${f.message}`),
          ...routeIntegrity.warnings,
        ],
        metrics: {
          findings: contentQa.findings.length, qaErrors: contentQa.countsBySeverity.error,
          qaWarnings: contentQa.countsBySeverity.warning, routes: routeIntegrity.metrics.routed,
          routeErrors: routeIntegrity.errors.length,
          mediaSlots: graphImportProvenance?.mediaSlots?.length ?? 0,
          textOnlyHero: graphImportProvenance?.heroMediaMissing ?? false,
        },
        artifactPaths: [qaPath, routePath], startedAt: t0,
      });
      await recordGate(r);
      if (r.status === 'FAIL') throw new Error(`Gate CMS_IMPORT_READY failed: ${r.errors[0]}`);
    }
    const contentJsonPath = join(artifactDir, 'content.json');
    await writeFile(contentJsonPath, JSON.stringify(content, null, 2));
    await emit('INFO', 'FACTORY_CONTENT_TRANSFORMED', 'Content extracted and transformed', { pages: content?.pages?.length ?? 0 });
    await (prisma as any).redesignRun.update({ where: { id: run.id }, data: { contentJsonPath } });

    const siteSlug = existingSite?.slug || `${slugify(l.companyName || l.websiteDomain || 'site')}-${l.id.slice(-6)}`;
    const previewSlug = existingSite?.previewToken || randomToken();

    const domain = l.websiteDomain || l.website.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // ---- CMS_IMPORTED ------------------------------------------------------
    t0 = Date.now();
    let siteId = existingSite?.id as string | undefined;
    let demoVariantId: string | undefined;
    // V3.7.4 — when canonical-domain resolution returns an existing site, its
    // preview token wins over the freshly minted one.
    let effectivePreviewSlug = previewSlug;
    if (gated('CMS_IMPORTED')) {
      await emit('INFO', 'FACTORY_CMS_IMPORT_STARTED', 'Importing to CMS', { mode, regenerateContent, runId: run.id });
      const imported = await importToCms({
        leadId: l.id,
        lead: { id: l.id, companyName: l.companyName, phone: l.phone, address: l.address, websiteDomain: l.websiteDomain },
        siteName: l.companyName || 'Generated Site',
        siteSlug,
        previewSlug,
        templateId,
        content,
        artifactDir,
        storageBaseUrl: '/redesign-media',
        runId: run.id,
        regenerateContent,
        fixture: options.fixture,
        fixtureOwner: options.fixtureOwner
      }, prisma);
      siteId = imported.siteId;
      demoVariantId = imported.demoVariantId;
      effectivePreviewSlug = imported.previewSlug || previewSlug;
      await emit('INFO', 'FACTORY_CMS_IMPORT_COMPLETED', 'CMS import completed', { siteId, demoVariantId, previewSlug: effectivePreviewSlug });

      await prisma.site.update({
        where: { id: siteId },
        data: { domain, status: 'ACTIVE', settings: { previewUrl: `http://localhost:3000/showcase/${effectivePreviewSlug}` } as any }
      });
      const r = gateResult('CMS_IMPORTED', {
        metrics: { siteId, demoVariantId: demoVariantId || '', pages: content.pages?.length ?? 0 },
        startedAt: t0,
      });
      await recordGate(r);
      if (r.status === 'FAIL') throw new Error(`Gate CMS_IMPORTED failed: ${r.errors[0]}`);
    }

    // A resume that skips CMS_IMPORTED still needs the canonical site's
    // active variant — resolve it from the DB (the import already ran in a
    // previous attempt).
    if (siteId && !demoVariantId) {
      demoVariantId = (await resolveActiveVariant(prisma, siteId))?.id;
    }

    // V3.7.4 — open the revision for this run. `resume` when the run is a
    // retry of a previous attempt (same variant, GENERATING/QA_FAILED
    // revision) — never a new Site, never a replacement preview. Runs whether
    // the import just executed or a resume skipped it.
    if (siteId && demoVariantId && !revisionStore) {
      revisionStore = createPrismaRevisionStore(prisma);
      const rr = await revisionStore.createOrResume({
        siteId, variantId: demoVariantId, runId: run.id, templateId,
        resume: !!options.resumeFromStage || mode === 'retry',
      });
      revisionId = rr.revision.id;
      // Immutable CMS snapshot for this build + content hash + route manifest.
      const [pg, sv, pr, pd, nw, vc] = await Promise.all([
        prisma.page.findMany({ where: { siteId } }),
        prisma.service.findMany({ where: { siteId } }),
        prisma.project.findMany({ where: { siteId } }),
        prisma.product.findMany({ where: { siteId } }),
        prisma.newsPost.findMany({ where: { siteId } }),
        prisma.vacancy.findMany({ where: { siteId } }),
      ]);
      const snapshot = { pages: pg, services: sv, projects: pr, products: pd, news: nw, vacancies: vc };
      const contentHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 16);
      // V3.7.6 Phase 4 — the revision's route manifest is the full set of
      // published CMS routes, not a hand-picked sample. Promotion requires
      // screenshot coverage of every one of them.
      revisionRoutes = await buildRouteManifest(prisma, siteId)
        .then((rs) => rs.map((x) => x.route || '/'))
        .catch(() => ['/']);
      await prisma.siteRevision.update({
        where: { id: revisionId },
        data: { contentSnapshot: snapshot as any, contentHash, routeManifest: revisionRoutes },
      });
      await emit('INFO', 'FACTORY_REVISION_OPENED', `Revision v${rr.revision.version} ${rr.resumed ? 'resumed' : 'created'}`, { revisionId, siteId, variantId: demoVariantId, version: rr.revision.version, resumed: rr.resumed });
    }

    // ---- RENDERED -----------------------------------------------------------
    t0 = Date.now();
    if (gated('RENDERED')) {
      await (prisma as any).redesignRun.update({
        where: { id: run.id },
        data: { siteId } as any
      });
      const siteBuild = await (prisma as any).siteBuild.create({
        data: {
          siteId,
          demoVariantId,
          templateId,
          status: 'SUCCESS',
          outputPath: `data/generated/sites/${siteId}`
        } as any
      });
      const snapshotId = await ensureDependencySnapshot(prisma, templateId, process.cwd(), { commitSha: process.env.GIT_SHA }).catch((err: any) => {
        console.error(`[FACTORY] dependency snapshot failed for ${siteId}:`, err.message);
        return undefined;
      });
      if (snapshotId) {
        await linkSiteBuildSnapshot(prisma, siteBuild.id, snapshotId);
      }
      const r = gateResult('RENDERED', { metrics: { siteId: siteId || '', siteBuildId: siteBuild.id }, startedAt: t0 });
      await recordGate(r);
    }

    // ---- RENDER_VALIDATED: structural validation + post-render QA ----------
    t0 = Date.now();
    if (gated('RENDER_VALIDATED')) {
      const validation = await validateGeneratedSite({ siteId: siteId!, prisma });
      const renderErrors: string[] = validation.ok ? [] : validation.missing.map((m) => `missing: ${m}`);
      const renderWarnings: string[] = [];

      let postRender: any;
      try {
        postRender = await runPostRenderQa({
          siteId: siteId!,
          previewToken: effectivePreviewSlug,
          prisma,
          baseUrl: options.renderQaBaseUrl,
          browser: options.renderQaBrowser,
          artifactDir,
          // V3.7.6 — the route manifest is derived from imported CMS entities,
          // never a hand-written list; QA covers every published route.
          exhaustive: true,
        });
      } catch (e: any) {
        renderErrors.push(`post-render QA crashed: ${e?.message || e}`);
      }
      if (postRender) {
        renderErrors.push(...postRender.errors);
        renderWarnings.push(...postRender.warnings);
        const prPath = join(artifactDir, 'post-render-qa.json');
        await writeFile(prPath, JSON.stringify(postRender, null, 2));
      }

      const r = gateResult('RENDER_VALIDATED', {
        errors: renderErrors,
        warnings: renderWarnings,
        metrics: {
          validationOk: validation.ok,
          routesChecked: postRender?.metrics?.routes ?? 0,
          renderChecks: postRender?.metrics?.checks ?? 0,
          browserTier: postRender?.browserTier ?? 'skipped',
        },
        artifactPaths: [join(artifactDir, 'post-render-qa.json')], startedAt: t0,
      });
      await recordGate(r);
      if (r.status === 'FAIL') throw new Error(`Gate RENDER_VALIDATED failed: ${r.errors[0]}`);
      await emit('INFO', 'FACTORY_VALIDATION_PASSED', 'Demo validation passed', { siteId });
    }

    // ---- VISUAL_VALIDATED: content-and-visual acceptance gate (V3.7.3) -----
    // Deterministic Playwright DOM checks — hero integrity, empty layouts,
    // leaked technical strings, internal labels, overflow. Up to two bounded
    // repair passes; defects after pass 2 → FAIL before HUMAN_REVIEW_READY.
    if (gated('VISUAL_VALIDATED')) {
      t0 = Date.now();
      const visualErrors: string[] = [];
      const visualWarnings: string[] = [];
      const repairLog: any[] = [];
      let lastReport: any;
      // V3.7.6 Phase 3 — no post-import CMS repairs. Visual-QA findings are a
      // gate verdict: a defect means the revision is QA_FAILED and the fix
      // belongs in the generic extractor/normalizer/importer, after which the
      // pipeline re-runs from the crawl snapshot.
      try {
        lastReport = await runVisualQa({
          siteId: siteId!,
          previewToken: effectivePreviewSlug,
          prisma,
          baseUrl: options.renderQaBaseUrl,
          artifactDir,
          pass: 1,
          routes: revisionRoutes.length
            ? revisionRoutes.map((r) => ({ route: r === '/' ? '' : r, label: r === '/' ? 'home' : r.replace(/^\//, '') }))
            : await pickQaRoutes(prisma, siteId!),
        });
      } catch (e: any) {
        visualErrors.push(`visual QA crashed: ${e?.message || e}`);
      }
      if (lastReport) {
        visualErrors.push(...lastReport.errors);
        visualWarnings.push(...lastReport.warnings);
        // V3.7.4 Phase 8 — screenshots are DB artifacts on the revision, not
        // just files. REVIEW_READY is unreachable without these rows.
        if (revisionStore && revisionId && Array.isArray(lastReport.screenshots)) {
          for (const s of lastReport.screenshots) {
            if (!s?.path) continue;
            await revisionStore.addScreenshot(revisionId, {
              route: s.route || '/',
              viewport: `${s.viewport?.w || 1440}x${s.viewport?.h || 900}`,
              storagePath: s.path,
            } as any).catch(() => undefined);
          }
        }
      }
      await writeFile(join(artifactDir, 'repair-log.json'), JSON.stringify({ passes: repairLog.length ? Math.max(...repairLog.map((r) => r.pass)) : 1, repairs: repairLog }, null, 2));
      const r = gateResult('VISUAL_VALIDATED', {
        errors: visualErrors,
        warnings: visualWarnings,
        metrics: {
          passes: repairLog.length ? Math.max(...repairLog.map((x) => x.pass)) : 1,
          repairsApplied: repairLog.length,
          findings: lastReport?.findings?.length ?? 0,
          screenshots: lastReport?.screenshots?.length ?? 0,
          missingCopyKeys: lastReport?.missingCopyKeys?.length ?? 0,
        },
        artifactPaths: [
          join(artifactDir, `visual-qa${repairLog.length ? '-p2' : ''}.json`),
          join(artifactDir, 'repair-log.json'),
          join(artifactDir, 'screenshots'),
        ],
        startedAt: t0,
      });
      await recordGate(r);
      if (r.status === 'FAIL') throw new Error(`Gate VISUAL_VALIDATED failed: ${r.errors[0]}`);
    }

    // ---- PREVIEW_PUBLISHED — verified Forge preview (V3.7.5) ---------------
    // preferred variant → canonical showcase 200 → verified PNG →
    // SitePreviewScreenshot persisted → gateway URL verified. A failure here
    // blocks REVIEW_READY and marks the site NEEDS_ATTENTION — generation can
    // never report success while the Forge card has no real preview.
    if (gated('PREVIEW_PUBLISHED')) {
      t0 = Date.now();
      const previewErrors: string[] = [];
      let published: { url: string; source: string; variantId?: string } | undefined;
      try {
        published = await publishForgePreview({
          siteId: siteId!,
          prisma,
          revisionId,
          renderBaseUrl: options.renderQaBaseUrl,
        });
      } catch (e: any) {
        previewErrors.push(e?.message || String(e));
      }
      const r = gateResult('PREVIEW_PUBLISHED', {
        errors: previewErrors,
        metrics: {
          previewUrl: published?.url || '',
          previewSource: published?.source || '',
          variantId: published?.variantId || '',
        },
        startedAt: t0,
      });
      await recordGate(r);
      if (r.status === 'FAIL') throw new Error(`Gate PREVIEW_PUBLISHED failed: ${r.errors[0]}`);
      await emit('INFO', 'FACTORY_PREVIEW_PUBLISHED', `Forge preview published (${published?.source})`, { siteId, url: published?.url });
    }

    // ---- REVIEW_READY — atomic revision promotion (V3.7.4) ------------------
    // Requires DB-backed screenshots covering the route manifest at both
    // viewports; failure leaves the revision QA_FAILED and the previously
    // active revision keeps serving the preview.
    if (revisionStore && revisionId) {
      try {
        await revisionStore.promote(revisionId, 'REVIEW_READY', revisionRoutes);
        await emit('INFO', 'FACTORY_REVISION_PROMOTED', 'Revision promoted to REVIEW_READY', { revisionId, routes: revisionRoutes.length });
      } catch (e: any) {
        await revisionStore.fail(revisionId, `promotion rejected: ${e?.message || e}`).catch(() => undefined);
        const r = gateResult('HUMAN_REVIEW_READY', {
          errors: [`revision promotion rejected: ${e?.message || e}`],
          startedAt: t0,
        });
        await recordGate(r);
        throw new Error(`Gate REVIEW_READY failed: ${e?.message || e}`);
      }
    }

    // ---- HUMAN_REVIEW_READY — reachable only when every gate passed --------
    await recordGate(gateResult('HUMAN_REVIEW_READY', {
      metrics: { siteId: siteId || '', previewSlug: effectivePreviewSlug, revisionId: revisionId || '' },
      startedAt: t0,
    }));

    clearInterval(heartbeat);
    clearInterval(stageWatchdog);
    await emit('INFO', 'FACTORY_COMPLETED', 'Site generation completed', { siteId, previewSlug: effectivePreviewSlug, revisionId });
    return { leadId: l.id, siteId, previewSlug: effectivePreviewSlug, runId: run.id, revisionId, stageResults };
  } catch (err: any) {
    clearInterval(heartbeat);
    clearInterval(stageWatchdog);
    // V3.7.4 — the failed revision is inspectable; the previously active
    // revision keeps serving the preview (activeRevisionId untouched).
    if (revisionStore && revisionId) {
      await revisionStore.fail(revisionId, err?.message || String(err)).catch(() => undefined);
    }
    await emit('ERROR', 'FACTORY_FAILED', `Site generation failed: ${err?.message || String(err)}`, { error: err?.message || String(err) });
    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { errorMessage: err?.message || String(err), stageResults: stageResults as any, stage: 'QA_FAILED' as any }
    });
    throw err;
  }
}
