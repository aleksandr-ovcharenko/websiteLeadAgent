import express, { type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma, requireSuperAdmin } from './auth.js';
import { captureVariantPreview, previewImageUrl } from '../../../packages/screenshot/src/index.js';
import { getPipelineStageLabel, generateSite, publishForgePreview, backfillForgePreviews, ForgePreviewError } from '@minsk/redesign-engine';

const router = express.Router();
router.use(express.json());

// Public read-only image serving: Forge cards render these via <img>, and the
// publish pipeline verifies this URL server-side — it cannot sit behind the
// session middleware. Path is confined to the site's screenshots dir; site ids
// are unguessable and the content is derived from public crawls.
router.get('/site-screenshots/:siteId/:file', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const file = String(req.params.file).replace(/[^a-zA-Z0-9_.-]/g, '');
  const dir = path.resolve('data/generated/sites', siteId, 'screenshots');
  const p = path.resolve(dir, file);
  if (!p.startsWith(dir)) { res.status(403).send(); return; }
  try {
    await fs.access(p);
    // Versioned by ?v= (variant id + capture time) — never heuristic-cache the
    // bare URL, so a regenerated preferred variant can never display stale.
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.sendFile(p);
  } catch {
    res.status(404).send();
  }
});

router.use(requireSuperAdmin);

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

function uiStatus(site: any) {
  if (site.status === 'ARCHIVED') return 'ARCHIVED';
  if (site.status === 'ACTIVE') return 'ACTIVE';
  const stage = site.lead?.redesignStage ?? 'NOT_SELECTED';
  if (['DEMO_APPROVED', 'READY_TO_CONTACT'].includes(stage)) return 'DEMO_APPROVED';
  if (['DEMO_GENERATED', 'SITE_RENDERED', 'AUDIT_DONE', 'RENDER_VALIDATED', 'VISUAL_VALIDATED', 'HUMAN_REVIEW_READY'].includes(stage)) return 'DEMO_GENERATED';
  if (['CONTENT_TRANSFORMED', 'CMS_IMPORTED', 'CONTENT_VALIDATED', 'GRAPH_BUILT', 'CMS_IMPORT_READY'].includes(stage)) return 'CONTENT_READY';
  return 'DRAFT';
}

function computeAttention(site: any, screenshot: any) {
  if (!site.domain) return { attention: 'Missing domain', attentionAction: 'Fix' as const };
  const previewError = (site.settings as any)?.previewError?.reason;
  if (previewError) return { attention: `Preview failed: ${previewError}`, attentionAction: 'Retry' as const };
  const lastBuild = site.builds?.[0];
  if (lastBuild && lastBuild.status === 'FAILED') return { attention: 'Preview build failed', attentionAction: 'Retry' as const };
  if (!screenshot) return { attention: 'Screenshot missing', attentionAction: 'Retry' as const };
  if (new Date(site.updatedAt) > new Date(screenshot.siteUpdatedAt)) return { attention: 'Preview outdated', attentionAction: 'Retry' as const };
  return { attention: undefined, attentionAction: undefined };
}

async function toPlatformSite(site: any): Promise<any> {
  const [pages, projects, news, services, products, media, screenshot, build] = await Promise.all([
    prisma.page.count({ where: { siteId: site.id } }),
    prisma.project.count({ where: { siteId: site.id } }),
    prisma.newsPost.count({ where: { siteId: site.id } }),
    prisma.service.count({ where: { siteId: site.id } }),
    prisma.product.count({ where: { siteId: site.id } }),
    prisma.media.count({ where: { siteId: site.id } }),
    prisma.sitePreviewScreenshot.findUnique({ where: { siteId: site.id } }),
    prisma.siteBuild.findFirst({ where: { siteId: site.id }, orderBy: { createdAt: 'desc' } })
  ]);

  const status = uiStatus(site);
  const stageLabel = getPipelineStageLabel(site.lead?.redesignStage);
  const { attention, attentionAction } = computeAttention(site, screenshot);
  const variants = site.demoVariants ?? [];
  const preferred = variants.find((v: any) => v.isPreferred) ?? variants[0];
  // No external placeholders: missing screenshot is a first-class UI state.
  const image = screenshot ? previewImageUrl(screenshot, preferred?.id) : null;
  const isFixture = (site.settings as any)?.fixture === true;

  return {
    id: site.id,
    name: site.name,
    domain: site.domain || '—',
    status,
    template: site.templateId,
    pages,
    projects,
    products,
    news,
    services,
    mediaCount: media,
    lastUpdated: formatDate(site.updatedAt),
    created: formatDate(site.createdAt),
    lastBuild: build ? formatDate(build.createdAt) : '—',
    lastAudit: '—',
    previewCaptured: screenshot ? formatDate(screenshot.capturedAt) : '—',
    previewOutdated: attention === 'Preview outdated',
    image,
    attention,
    attentionAction,
    previewToken: preferred?.previewToken ?? site.previewToken,
    originalWebsiteUrl: site.lead?.website || null,
    reviewStatus: (site.settings as any)?.reviewStatus || null,
    fixture: isFixture || undefined,
    demoVariants: variants.map((v: any) => ({
      id: v.id,
      name: v.name,
      templateId: v.templateId,
      previewToken: v.previewToken,
      isPreferred: v.isPreferred,
      status: v.status,
      screenshotUrl: v.screenshot?.url ? previewImageUrl(v.screenshot, v.id) : null,
      hasScreenshot: !!v.screenshot
    })),
    stageLabel
  };
}

router.get('/api/hub/stats', requireSuperAdmin, async (_req: Request, res: Response) => {
  const [totalLeads, goodLeads, totalSites, activeRuns, runningRuns] = await Promise.all([
    prisma.lead.count({ where: { mergeStatus: 'NONE', archivedAt: null } }),
    prisma.lead.count({ where: { manualReviewStatus: 'GOOD', mergeStatus: 'NONE', archivedAt: null } }),
    prisma.site.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.redesignRun.count(),
    prisma.redesignRun.count({
      where: { stage: { notIn: ['NOT_SELECTED', 'READY_TO_CONTACT', 'DEMO_APPROVED'] } }
    }),
  ]);
  res.json({
    totalLeads,
    goodLeads,
    totalSites,
    activeRuns,
    runningRuns,
  });
});

router.get('/api/platform/sites', async (req: Request, res: Response) => {
  // QA/test fixtures are never shown in Forge unless explicitly requested.
  const includeFixtures = req.query.includeFixtures === 'true';
  // Postgres JSON semantics: `NOT (path equals true)` is NULL (not true) when the
  // key is absent, which would exclude every non-fixture row. Include a site
  // unless settings.fixture is explicitly `true`.
  // V3.7.4 — consolidated/archived duplicates (mergedIntoSiteId set) never
  // appear as ordinary customer sites.
  const where = includeFixtures ? { mergedIntoSiteId: null } : {
    mergedIntoSiteId: null,
    OR: [
      { settings: { path: ['fixture'], equals: Prisma.AnyNull } },
      { settings: { path: ['fixture'], equals: false } },
      { settings: { path: ['fixture'], equals: Prisma.JsonNull } },
    ]
  };
  const sites = await prisma.site.findMany({
    where: where as any,
    include: {
      lead: { select: { redesignStage: true, website: true } },
      builds: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, createdAt: true } },
      demoVariants: { include: { screenshot: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });
  const items = await Promise.all(sites.map(toPlatformSite));
  res.json({ sites: items });
});

router.get('/api/platform/sites/:siteId', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      lead: { select: { redesignStage: true, website: true } },
      builds: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, createdAt: true } },
      demoVariants: { include: { screenshot: true } }
    }
  });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  res.json({ site: await toPlatformSite(site) });
});

router.post('/api/platform/sites', async (req: Request, res: Response) => {
  const { name, slug, domain, templateId } = req.body;
  if (!name || !slug || !templateId) { res.status(400).json({ error: 'missing_fields' }); return; }
  const existing = await prisma.site.findUnique({ where: { slug } });
  if (existing) { res.status(409).json({ error: 'slug_exists' }); return; }
  const site = await prisma.site.create({
    data: { name, slug, domain: domain || null, templateId, previewToken: randomToken(), status: 'DRAFT' }
  });
  res.json({ ok: true, site: await toPlatformSite(site) });
});

router.post('/api/platform/sites/:siteId/archive', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const site = await prisma.site.update({
    where: { id: siteId },
    data: { status: 'ARCHIVED' }
  });
  res.json({ ok: true, site: await toPlatformSite(site) });
});

router.delete('/api/platform/sites/:siteId', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { lead: { select: { id: true } } } });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }

  await prisma.$transaction(async (tx) => {
    await tx.site.delete({ where: { id: siteId } });
  });

  // Clean up generated site media directory if present
  try {
    const siteDir = path.resolve('data/generated/sites', siteId);
    await fs.rm(siteDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }

  try {
    if (site.lead?.id) {
      const leadDir = path.resolve('data/redesign', site.lead.id);
      await fs.rm(leadDir, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup failures
  }

  res.json({ ok: true });
});

/** Per-variant detail screenshots — best-effort, never gates generation. */
async function captureVariantScreenshots(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { demoVariants: { where: { status: 'ACTIVE' } } }
  });
  if (!site) return [];
  const results: { variantId?: string; url: string }[] = [];
  for (const v of site.demoVariants) {
    try {
      const r = await captureVariantPreview(site as any, v, prisma);
      results.push({ variantId: v.id, url: r.url });
    } catch (err: any) {
      console.error(`[platform] variant screenshot failed for ${v.id}:`, err?.message);
    }
  }
  return results;
}

async function captureSiteAndVariants(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return null;
  const results = await captureVariantScreenshots(siteId);
  // Site-level Forge card: the verified publish path (showcase 200 → PNG
  // verified → row persisted → gateway URL verified). Throws on failure.
  const { url } = await publishForgePreview({ siteId, prisma });
  return { url, variants: results };
}

router.post('/api/platform/sites/:siteId/screenshot', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  try {
    const result = await captureSiteAndVariants(siteId);
    res.json({ ok: true, url: result?.url, variants: result?.variants });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: 'preview_capture_failed', reason: err?.reason || err?.message });
  }
});

// Preferred-variant selection — the Forge card must follow immediately.
// Atomic: flip preference, then publish a verified preview with a new cache
// version (?v=<variantId>-<ts>) so no card can show the old variant.
router.post('/api/platform/sites/:siteId/variants/:variantId/prefer', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const variantId = String(req.params.variantId);
  const variant = await (prisma as any).demoVariant.findFirst({ where: { id: variantId, siteId, status: 'ACTIVE' } });
  if (!variant) { res.status(404).json({ error: 'not_found' }); return; }

  await prisma.$transaction([
    (prisma as any).demoVariant.updateMany({ where: { siteId, isPreferred: true, id: { not: variantId } }, data: { isPreferred: false } }),
    (prisma as any).demoVariant.update({ where: { id: variantId }, data: { isPreferred: true } }),
    prisma.site.update({ where: { id: siteId }, data: { preferredDemoVariantId: variantId, updatedAt: new Date() } }),
  ]);

  try {
    const preview = await publishForgePreview({ siteId, prisma });
    res.json({ ok: true, preferredVariantId: variantId, url: preview.url, source: preview.source });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: 'preview_capture_failed', reason: err?.reason || err?.message });
  }
});

// Managed backfill: verified previews for every active site missing one.
// One job, sequential, no site regeneration — screenshots only.
router.post('/api/platform/screenshots/backfill', requireSuperAdmin, async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, Number(req.body?.limit ?? 50)));
  const report = await backfillForgePreviews({ prisma, limit });
  await prisma.activityEvent.create({
    data: {
      level: report.failed ? 'WARN' : 'INFO',
      module: 'FACTORY',
      eventType: 'FORGE_PREVIEW_BACKFILL',
      message: `Preview backfill: ${report.succeeded} captured, ${report.failed} failed, ${report.skipped} already present`,
      details: { scanned: report.scanned, succeeded: report.succeeded, failed: report.failed, skipped: report.skipped },
    },
  }).catch(() => undefined);
  res.json({ ok: true, report });
});

// Human review transitions — the product workflow for generation approval.
// SITE STATUS (ACTIVE/DRAFT) stays separate; this only moves reviewStatus.
const REVIEW_TRANSITIONS: Record<string, string[]> = {
  AWAITING_HUMAN_REVIEW: ['DEMO_READY', 'NEEDS_ATTENTION'],
  NEEDS_ATTENTION: ['AWAITING_HUMAN_REVIEW'],
  GENERATING: [],
  VALIDATION: ['AWAITING_HUMAN_REVIEW'],
  DEMO_READY: ['NEEDS_ATTENTION'],
};
router.post('/api/platform/sites/:siteId/review', requireSuperAdmin, async (req: Request, res: Response) => {
  const site = await prisma.site.findUnique({ where: { id: String(req.params.siteId) } });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  const to = String(req.body?.status || '');
  const current = (site.settings as any)?.reviewStatus || 'GENERATING';
  const allowed = REVIEW_TRANSITIONS[current] || [];
  if (!allowed.includes(to)) {
    res.status(409).json({ error: 'invalid_transition', from: current, allowed });
    return;
  }
  const settings = { ...(site.settings as any || {}), reviewStatus: to, reviewedAt: new Date().toISOString() };
  await prisma.site.update({ where: { id: site.id }, data: { settings } });
  res.json({ ok: true, reviewStatus: to });
});

router.get('/api/factory/runs', requireSuperAdmin, async (req: Request, res: Response) => {
  const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;
  const raw = await prisma.redesignRun.findMany({
    where: leadId ? { leadId } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      lead: { select: { id: true, companyName: true } },
      site: { select: { id: true, name: true, domain: true, templateId: true, previewToken: true, status: true } }
    }
  });

  const stageOrder = [
    'NOT_SELECTED',
    'SELECTED_FOR_REDESIGN',
    'CRAWL_READY',
    'CRAWL_FAILED',
    'CONTENT_EXTRACTED',
    'CONTENT_VALIDATED',
    'GRAPH_BUILT',
    'CMS_IMPORT_READY',
    'CONTENT_TRANSFORMED',
    'CMS_IMPORTED',
    'SITE_RENDERED',
    'RENDER_VALIDATED',
    'VISUAL_VALIDATED',
    'AUDIT_DONE',
    'DEMO_GENERATED',
    'HUMAN_REVIEW_READY',
    'DEMO_APPROVED',
    'READY_TO_CONTACT'
  ];

  const stageIndex = (stage: string) => stageOrder.indexOf(stage || '');

  const runs = raw.map((run: any, i: number) => {
    const totalStages = 8;
    const idx = stageIndex(run.stage);
    const isFailed = !!run.errorMessage;
    const isCompleted = ['DEMO_GENERATED', 'HUMAN_REVIEW_READY', 'DEMO_APPROVED', 'READY_TO_CONTACT'].includes(run.stage);
    const isQueued = ['NOT_SELECTED', 'SELECTED_FOR_REDESIGN'].includes(run.stage) && !isFailed;
    const isRunning = !isFailed && !isCompleted && !isQueued;

    let status: 'queued' | 'running' | 'failed' | 'completed' = isCompleted ? 'completed' : isFailed ? 'failed' : isQueued ? 'queued' : 'running';
    let stagesDone = Math.max(0, Math.min(idx - 1, totalStages));
    if (status === 'completed') stagesDone = totalStages;
    if (status === 'queued') stagesDone = 0;

    const startedAt = run.createdAt ? new Date(run.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const currentStage = getPipelineStageLabel(run.stage);

    return {
      id: run.id,
      runNumber: raw.length - i,
      company: run.lead?.companyName || run.site?.name || '—',
      domain: run.site?.domain || '—',
      status,
      currentStage,
      stagesDone,
      stagesTotal: totalStages,
      started: startedAt,
      duration: '—',
      failedStage: isFailed ? currentStage : undefined,
      failedReason: run.errorMessage || undefined,
      leadId: run.leadId,
      crawlJsonPath: run.crawlJsonPath,
      homepage: run.homepageCandidate,
      stageResults: Array.isArray(run.stageResults) ? run.stageResults : [],
      resumeFromStage: Array.isArray(run.stageResults)
        ? [...run.stageResults].reverse().find((g: any) => g?.status === 'FAIL')?.retryFromStage ?? null
        : null,
      siteId: run.site?.id,
      forgeId: run.site?.id,
      previewToken: run.site?.previewToken,
    };
  });

  res.json({ runs });
});

router.post('/api/platform/sites/:siteId/variants', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const { templateId } = req.body;
  if (!templateId) { res.status(400).json({ error: 'missing_template' }); return; }
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  const existing = await (prisma as any).demoVariant.findFirst({ where: { siteId, templateId } });
  if (existing) { res.status(409).json({ error: 'variant_exists' }); return; }

  const variant = await (prisma as any).demoVariant.create({
    data: {
      siteId,
      templateId,
      previewToken: randomToken(),
      name: templateId,
      status: 'ACTIVE',
      isPreferred: false,
      themeConfig: site.themeConfig as any
    } as any
  });

  await (prisma as any).siteBuild.create({
    data: {
      siteId,
      demoVariantId: variant.id,
      templateId,
      status: 'SUCCESS',
      outputPath: `data/generated/sites/${siteId}`
    } as any
  });

  // Best-effort variant screenshot so Forge cards never show a broken image.
  try {
    const full = await prisma.site.findUnique({ where: { id: siteId }, include: { builds: { orderBy: { createdAt: 'desc' }, take: 5 } } });
    if (full) await captureVariantPreview(full as any, variant, prisma);
  } catch (err: any) {
    console.error('[platform] variant screenshot failed:', err?.message);
  }

  res.json({ ok: true, variant });
});

router.delete('/api/platform/sites/:siteId/variants/:variantId', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const variantId = String(req.params.variantId);
  const variant = await (prisma as any).demoVariant.findFirst({ where: { id: variantId, siteId } });
  if (!variant) { res.status(404).json({ error: 'not_found' }); return; }
  await (prisma as any).demoVariant.delete({ where: { id: variantId } });
  res.json({ ok: true });
});

router.get('/api/factory/runs/:runId/crawl', requireSuperAdmin, async (req: Request, res: Response) => {
  const runId = String(req.params.runId);
  const run = await prisma.redesignRun.findUnique({ where: { id: runId } });
  if (!run || !run.crawlJsonPath) { res.status(404).json({ error: 'not_found' }); return; }
  try {
    const data = await fs.readFile(run.crawlJsonPath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err: any) {
    res.status(500).json({ error: 'read_failed', message: err?.message });
  }
});

router.get('/api/factory/runs/:runId/source-documents', requireSuperAdmin, async (req: Request, res: Response) => {
  const runId = String(req.params.runId);
  const run = await prisma.redesignRun.findUnique({ where: { id: runId } });
  if (!run || !run.crawlJsonPath) { res.status(404).json({ error: 'not_found' }); return; }
  const sourceDocPath = run.crawlJsonPath.replace(/crawl\.json$/i, 'source-documents.json');
  try {
    const data = await fs.readFile(sourceDocPath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err: any) {
    res.status(500).json({ error: 'read_failed', message: err?.message });
  }
});

router.get('/api/factory/runs/:runId/source-content-graph', requireSuperAdmin, async (req: Request, res: Response) => {
  const runId = String(req.params.runId);
  const run = await prisma.redesignRun.findUnique({ where: { id: runId } });
  if (!run || !run.crawlJsonPath) { res.status(404).json({ error: 'not_found' }); return; }
  const graphPath = run.crawlJsonPath.replace(/crawl\.json$/i, 'source-content-graph.json');
  try {
    const data = await fs.readFile(graphPath, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (err: any) {
    res.status(500).json({ error: 'read_failed', message: err?.message });
  }
});

// Forge "Rebuild" — regenerate a site in place from its latest redesign run.
// Same pipeline as /api/factory/runs/:runId/retry; resolves the run by site.
router.post('/api/platform/sites/:siteId/rebuild', async (req: Request, res: Response) => {
  const siteId = String(req.params.siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) { res.status(404).json({ error: 'not_found' }); return; }
  const run = await prisma.redesignRun.findFirst({
    where: { siteId, crawlJsonPath: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (!run) { res.status(409).json({ error: 'no_rebuildable_run', message: 'Site has no redesign run with a crawl artifact' }); return; }

  // V3.7.4 Phase 7 — async job: return the runId immediately; the rebuild
  // resumes the same revision via checkpoints and never creates a new Site.
  generateSite({
    leadId: run.leadId,
    crawlRunId: run.id,
    templateId: site.templateId || 'construction-modern-v1',
    force: true,
    mode: 'retry',
    prisma,
  }).then(async (result: any) => {
    // Site preview already published (or failed the run) by PREVIEW_PUBLISHED.
    try { await captureVariantScreenshots(result.siteId); }
    catch (err: any) { console.error('[platform] post-rebuild variant screenshots failed:', err?.message); }
  }).catch((err: any) => console.error(`[platform] async rebuild failed for site ${siteId}:`, err?.message || err));

  res.status(202).json({ ok: true, async: true, runId: run.id, siteId });
});

router.post('/api/factory/runs/:runId/retry', requireSuperAdmin, async (req: Request, res: Response) => {
  const runId = String(req.params.runId);
  const run = await prisma.redesignRun.findUnique({
    where: { id: runId },
    include: { site: { select: { id: true, templateId: true } } }
  });
  if (!run) { res.status(404).json({ error: 'not_found' }); return; }
  if (!run.crawlJsonPath) { res.status(400).json({ error: 'no_crawl_artifact' }); return; }

  // Retry restarts from the owning stage of the last FAIL gate, not from the
  // beginning — the gate's retryFromStage carries that decision.
  const gates = Array.isArray((run as any).stageResults) ? (run as any).stageResults as any[] : [];
  const resumeFromStage = [...gates].reverse().find((g) => g?.status === 'FAIL')?.retryFromStage;

  // V3.7.4 Phase 7 — async job: return the runId immediately; retry resumes
  // the failed revision from its last checkpoint instead of starting over.
  generateSite({
    leadId: run.leadId,
    crawlRunId: run.id,
    templateId: run.site?.templateId || 'construction-modern-v1',
    force: true,
    mode: 'retry',
    resumeFromStage,
    prisma,
  }).then(async (result: any) => {
    // Site preview already published (or failed the run) by PREVIEW_PUBLISHED.
    try { await captureVariantScreenshots(result.siteId); }
    catch (err: any) { console.error('[platform] post-build variant screenshots failed:', err?.message); }
  }).catch((err: any) => console.error(`[platform] async retry failed for run ${runId}:`, err?.message || err));

  res.status(202).json({ ok: true, async: true, runId: run.id });
});

export { router as platformRouter };
