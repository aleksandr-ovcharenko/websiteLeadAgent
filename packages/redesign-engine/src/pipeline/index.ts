import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { crawlSite } from '../crawl/crawlSite.js';
import { buildSourceDocuments, sourceDocumentToCrawledPage } from '../extract/buildSourceDocuments.js';
import { extractFromCrawl } from '../extract/extractFromCrawl.js';
import { importToCms } from '../import/importToCms.js';
import { validateGeneratedSite } from './validateSite.js';
import { buildSourceContentGraph } from '../semantic/graph.js';
import type { CrawlResult } from '../types.js';

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
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
  prisma?: PrismaClient;
  onActivity?: ActivityHandler;
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

  const activeRun = await (prisma as any).redesignRun.findFirst({
    where: {
      leadId: l.id,
      stage: { notIn: ['CRAWL_FAILED', 'DEMO_GENERATED', 'DEMO_APPROVED', 'READY_TO_CONTACT'] },
      errorMessage: null
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

  if (l.manualReviewStatus !== 'GOOD') {
    throw new Error(`Lead ${l.id} is not GOOD (status: ${l.manualReviewStatus})`);
  }

  let run: any;
  let crawlResult: CrawlResult;
  let crawlJsonPath: string;

  if (options.crawlRunId) {
    const existingRun = await (prisma as any).redesignRun.findUnique({
      where: { id: options.crawlRunId },
      include: { lead: true }
    });
    if (!existingRun) throw new Error(`Crawl run not found: ${options.crawlRunId}`);
    if (existingRun.leadId !== l.id) throw new Error(`Crawl run ${options.crawlRunId} does not belong to lead ${l.id}`);
    if (!options.force && existingRun.stage !== 'CRAWL_READY' && existingRun.stage !== 'SELECTED_FOR_REDESIGN' && existingRun.stage !== 'CRAWL_FAILED') {
      throw new Error(`Crawl run ${options.crawlRunId} is already ${existingRun.stage}. Use force to regenerate.`);
    }
    if (!existingRun.crawlJsonPath) throw new Error(`Crawl run ${options.crawlRunId} has no crawl artifact`);

    crawlJsonPath = existingRun.crawlJsonPath;
    const raw = await readFile(crawlJsonPath, 'utf8');
    crawlResult = JSON.parse(raw) as CrawlResult;
    run = existingRun;

    if (options.force) {
      await (prisma as any).redesignRun.update({
        where: { id: run.id },
        data: { errorMessage: null, stage: 'CRAWL_READY' }
      });
    }
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
  const existingSite = l.site;
  const baseUrl = crawlResult.homepage?.url || l.website;
  const artifactDir = dirname(crawlJsonPath);

  try {
    const crawled = crawlResult.pages;
    const navigation = crawlResult.navigation;

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: {
        currentCrawl: { homepage: crawlResult.homepage, pageCount: crawled.length, warnings: crawlResult.warnings } as any,
        stage: 'CONTENT_EXTRACTED'
      }
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CONTENT_EXTRACTED' }
    });

    // V2: deterministic, DOM/language-agnostic source documents.
    const sourceDocuments = buildSourceDocuments(crawlResult);
    const sourceDocumentsJsonPath = join(artifactDir, 'source-documents.json');
    await writeFile(sourceDocumentsJsonPath, JSON.stringify(sourceDocuments, null, 2));

    // V2 Phase 2A: build the typed semantic content graph in shadow mode.
    const sourceContentGraph = buildSourceContentGraph({ sourceDocuments, baseUrl });
    const sourceContentGraphPath = join(artifactDir, 'source-content-graph.json');
    await writeFile(sourceContentGraphPath, JSON.stringify(sourceContentGraph, null, 2));
    await emit('INFO', 'FACTORY_SEMANTIC_GRAPH_BUILT', `Semantic graph built (${sourceContentGraph.pages.length} pages, ${sourceContentGraph.services.length} services, ${sourceContentGraph.projects.length} projects, ${sourceContentGraph.news.length} news)`, { sourceContentGraphPath, pages: sourceContentGraph.pages.length, services: sourceContentGraph.services.length, projects: sourceContentGraph.projects.length, news: sourceContentGraph.news.length, warnings: sourceContentGraph.warnings.length });

    if (options.semanticOnly) {
      await (prisma as any).redesignRun.update({
        where: { id: run.id },
        data: { currentCrawl: { homepage: crawlResult.homepage, pageCount: crawled.length, warnings: crawlResult.warnings, sourceContentGraphPath, sourceDocumentsJsonPath } as any, stage: 'CONTENT_EXTRACTED' }
      });
      return { leadId: l.id, runId: run.id, sourceDocumentsJsonPath, sourceContentGraphPath, sourceContentGraph };
    }

    // LEGACY/V1: extract structured content for the current live generator.
    // This path is intentionally kept multilingual and will be replaced by Phase 2 semantic generation.
    const crawledPages = sourceDocuments.map(sourceDocumentToCrawledPage);
    const content = extractFromCrawl(crawledPages, baseUrl, sourceDocuments[0]?.chrome.nav?.primary || crawlResult.navigation || []);
    const contentJsonPath = join(artifactDir, 'content.json');
    await writeFile(contentJsonPath, JSON.stringify(content, null, 2));
    await emit('INFO', 'FACTORY_CONTENT_TRANSFORMED', 'Content extracted and transformed', { pages: content?.pages?.length ?? 0 });

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { contentJsonPath, stage: 'CONTENT_TRANSFORMED' }
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CONTENT_TRANSFORMED' }
    });

    const siteSlug = existingSite?.slug || `${slugify(l.companyName || l.websiteDomain || 'site')}-${l.id.slice(-6)}`;
    const previewSlug = existingSite?.previewToken || randomToken();

    const domain = l.websiteDomain || l.website.replace(/^https?:\/\//, '').replace(/\/$/, '');

    await emit('INFO', 'FACTORY_CMS_IMPORT_STARTED', 'Importing to CMS', { mode, regenerateContent, runId: run.id });
    const { siteId, demoVariantId } = await importToCms({
      leadId: l.id,
      lead: { id: l.id, companyName: l.companyName, phone: l.phone, address: l.address },
      siteName: l.companyName || 'Generated Site',
      siteSlug,
      previewSlug,
      templateId,
      content,
      artifactDir,
      storageBaseUrl: '/redesign-media',
      runId: run.id,
      regenerateContent
    }, prisma);
    await emit('INFO', 'FACTORY_CMS_IMPORT_COMPLETED', 'CMS import completed', { siteId, demoVariantId, previewSlug });

    await prisma.site.update({
      where: { id: siteId },
      data: { domain, status: 'ACTIVE', settings: { previewUrl: `http://localhost:3000/showcase/${previewSlug}` } as any }
    });

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { siteId, stage: 'SITE_RENDERED' } as any
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'DEMO_GENERATED' } as any
    });

    await (prisma as any).siteBuild.create({
      data: {
        siteId,
        demoVariantId,
        templateId,
        status: 'SUCCESS',
        outputPath: `data/generated/sites/${siteId}`
      } as any
    });

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { stage: 'AUDIT_DONE' } as any
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'AUDIT_DONE' } as any
    });

    const validation = await validateGeneratedSite({ siteId, prisma });
    if (!validation.ok) {
      await emit('ERROR', 'FACTORY_VALIDATION_FAILED', 'Demo generation validation failed', { missing: validation.missing });
      throw new Error(`Demo generation incomplete: ${validation.missing.join(', ')}`);
    }
    await emit('INFO', 'FACTORY_VALIDATION_PASSED', 'Demo validation passed', { siteId });

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { stage: 'DEMO_GENERATED' } as any
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'DEMO_GENERATED' } as any
    });

    await emit('INFO', 'FACTORY_COMPLETED', 'Site generation completed', { siteId, previewSlug });
    return { leadId: l.id, siteId, previewSlug, runId: run.id, validation };
  } catch (err: any) {
    await emit('ERROR', 'FACTORY_FAILED', `Site generation failed: ${err?.message || String(err)}`, { error: err?.message || String(err) });
    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { errorMessage: err?.message || String(err) }
    });
    throw err;
  }
}
