import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Request, Response } from 'express';
import pino from 'pino';
import { sessionMiddleware, authRouter, requireSuperAdmin } from './auth.js';
import { platformRouter } from './platform.js';
import { generateSite } from '@minsk/redesign-engine';
import { DiscoveryService, listDiscoveryProviders, getDiscoveryProvider, DISCOVERY_PRESETS } from './discovery/index.js';
import { OperationService } from './operations/index.js';

const prisma = new PrismaClient();
const app = express();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const discovery = new DiscoveryService({ prisma, logger, env: process.env });
const operations = new OperationService({ prisma, logger, env: process.env, discovery });

app.use(sessionMiddleware);
app.use(express.json());

const PORT = Number(process.env.PLATFORM_API_PORT ?? process.env.PORT ?? 3333);

function numParam(v: unknown, fallback: number) {
  const n = typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

app.get('/', (_req: Request, res: Response) => {
  res.json({ service: 'platform-api', status: 'ok' });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ service: 'platform-api', status: 'ok' });
});

app.get('/api/leads', requireSuperAdmin, async (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Math.floor(numParam(req.query.limit, 50))));
  const offset = Math.max(0, Math.floor(numParam(req.query.offset, 0)));
  const minLead = numParam(req.query.minLead, 0);
  const minBiz = numParam(req.query.minBiz, 0);
  const maxWeb = numParam(req.query.maxWeb, 100);
  const minV2 = numParam(req.query.minV2, 0);
  const maxV2 = numParam(req.query.maxV2, 100);
  const aiStatus = typeof req.query.aiStatus === 'string' ? req.query.aiStatus : '';
  const manual = typeof req.query.manual === 'string' ? req.query.manual : '';
  const websiteStatus = typeof req.query.websiteStatus === 'string' ? req.query.websiteStatus : '';
  const enrichmentStatus = typeof req.query.enrichmentStatus === 'string' ? req.query.enrichmentStatus : '';
  const auditStatus = typeof req.query.auditStatus === 'string' ? req.query.auditStatus : '';
  const includeExcluded = req.query.includeExcluded === '1';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'lead_desc';
  const discoveryRunId = typeof req.query.discoveryRunId === 'string' ? req.query.discoveryRunId : '';

  const orderBy = (() => {
    const stable = [{ id: 'asc' as const }];
    switch (sort) {
      case 'v2_desc':
        return [{ leadScoreV2: 'desc' as const }, { leadScore: 'desc' as const }, ...stable];
      case 'v2_asc':
        return [{ leadScoreV2: 'asc' as const }, { leadScore: 'desc' as const }, ...stable];
      case 'lead_asc':
        return [{ leadScore: 'asc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'lead_desc':
        return [{ leadScore: 'desc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'biz_desc':
        return [{ businessScore: 'desc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'biz_asc':
        return [{ businessScore: 'asc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'visual_desc':
        return [{ visualQualityScore: 'desc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'visual_asc':
        return [{ visualQualityScore: 'asc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'tech_desc':
        return [{ technicalQualityScore: 'desc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'tech_asc':
        return [{ technicalQualityScore: 'asc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'web_desc':
        return [{ websiteQualityScore: 'desc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      case 'web_asc':
        return [{ websiteQualityScore: 'asc' as const }, { leadScoreV2: 'desc' as const }, ...stable];
      default:
        return [{ leadScoreV2: 'desc' as const }, { leadScore: 'desc' as const }, ...stable];
    }
  })();

  const where: any = {};

  if (Number.isFinite(minLead) && minLead > 0) {
    where.leadScore = { gte: minLead };
  }

  if (Number.isFinite(minBiz) && minBiz > 0) {
    where.businessScore = { gte: minBiz };
  }

  if (Number.isFinite(maxWeb) && maxWeb < 100) {
    where.websiteQualityScore = { lte: maxWeb };
  }

  if ((Number.isFinite(minV2) && minV2 > 0) || (Number.isFinite(maxV2) && maxV2 < 100)) {
    where.leadScoreV2 = { gte: minV2, lte: maxV2 };
  }

  if (aiStatus) {
    where.visualAnalysis = { status: aiStatus };
  }

  if (manual) {
    where.manualReviewStatus = manual;
  }

  if (websiteStatus) {
    where.websiteStatus = websiteStatus;
  } else if (!includeExcluded) {
    where.websiteStatus = 'FOUND';
  }

  if (enrichmentStatus) {
    where.enrichmentStatus = enrichmentStatus;
  }

  if (auditStatus) {
    where.auditStatus = auditStatus;
  }

  if (discoveryRunId) {
    const run = await prisma.discoveryRun.findUnique({ where: { id: discoveryRunId }, select: { leadIds: true } });
    if (run?.leadIds?.length) {
      where.id = { in: run.leadIds };
    } else {
      where.id = { in: [] };
    }
  }

  if (q.length > 0) {
    const tokens = q
      .split(/[\s,;]+/g)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);

    if (tokens.length === 1) {
      const t = tokens[0] ?? '';
      where.OR = [
        { companyName: { contains: t, mode: 'insensitive' } },
        { website: { contains: t, mode: 'insensitive' } },
        { websiteDomain: { contains: t, mode: 'insensitive' } },
        { phone: { contains: t, mode: 'insensitive' } },
        { address: { contains: t, mode: 'insensitive' } },
        { manualReviewNote: { contains: t, mode: 'insensitive' } }
      ];
    } else if (tokens.length > 1) {
      where.AND = tokens.map((t) => ({
        OR: [
          { companyName: { contains: t, mode: 'insensitive' } },
          { website: { contains: t, mode: 'insensitive' } },
          { websiteDomain: { contains: t, mode: 'insensitive' } },
          { phone: { contains: t, mode: 'insensitive' } },
          { address: { contains: t, mode: 'insensitive' } },
          { manualReviewNote: { contains: t, mode: 'insensitive' } }
        ]
      }));
    }
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: orderBy as any,
    skip: offset,
    take: limit,
    select: {
      id: true,
      companyName: true,
      categories: true,
      website: true,
      websiteDomain: true,
      phone: true,
      address: true,
      createdAt: true,
      leadScore: true,
      businessScore: true,
      websiteQualityScore: true,
      technicalQualityScore: true,
      visualQualityScore: true,
      businessConfidenceScore: true,
      leadScoreV2: true,
      websiteStatus: true,
      websiteIneligibilityReason: true,
      enrichmentStatus: true,
      scoreStatus: true,
      generationStatus: true,
      manualReviewStatus: true,
      manualReviewNote: true,
      reviewedAt: true,
      auditStatus: true,
      redesignStage: true,
      site: {
        select: {
          id: true,
          previewToken: true,
          status: true
        }
      },
      lighthouseReport: {
        select: {
          performance: true,
          seo: true,
          accessibility: true,
          bestPractices: true
        }
      },
      visualAnalysis: {
        select: {
          status: true,
          modernity: true,
          visualQuality: true,
          mobileUX: true,
          trust: true,
          ctaQuality: true,
          contentStructure: true,
          visualHierarchy: true,
          brandConsistency: true,
          redesignPotential: true,
          problems: true,
          strengths: true,
          summary: true,
          model: true,
          promptVersion: true,
          updatedAt: true,
          errorMessage: true
        }
      }
    } as any
  });

  res.json({ items: leads, meta: { limit, offset, q, sort, discoveryRunId, websiteStatus, enrichmentStatus } });
});

app.get('/api/leads/stats', requireSuperAdmin, async (req: Request, res: Response) => {
  const discoveryRunId = typeof req.query.discoveryRunId === 'string' ? req.query.discoveryRunId : '';
  const where: any = {};
  if (discoveryRunId) {
    const run = await prisma.discoveryRun.findUnique({ where: { id: discoveryRunId }, select: { leadIds: true } });
    if (run?.leadIds?.length) where.id = { in: run.leadIds };
    else where.id = { in: [] };
  }
  const [
    total,
    withWebsite,
    withoutWebsite,
    enriched,
    audited,
    lighthoused,
    aiAnalyzed,
    scored,
    good,
    selected,
    generated,
    failed
  ] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, websiteStatus: 'FOUND' } }),
    prisma.lead.count({ where: { ...where, websiteStatus: { in: ['UNKNOWN', 'NOT_FOUND'] } } }),
    prisma.lead.count({ where: { ...where, enrichmentStatus: 'SUCCESS' } }),
    prisma.lead.count({ where: { ...where, auditStatus: 'SUCCESS' } }),
    prisma.lead.count({ where: { ...where, lighthouseReport: { isNot: null } } }),
    prisma.lead.count({ where: { ...where, visualAnalysis: { status: 'SUCCESS' } } }),
    prisma.lead.count({ where: { ...where, leadScoreV2: { not: null } } }),
    prisma.lead.count({ where: { ...where, manualReviewStatus: 'GOOD' } }),
    prisma.lead.count({ where: { ...where, redesignStage: 'SELECTED_FOR_REDESIGN' } }),
    prisma.lead.count({ where: { ...where, site: { isNot: null } } }),
    prisma.lead.count({ where: { ...where, auditStatus: 'FAILED' } })
  ]);
  res.json({
    total,
    withWebsite,
    withoutWebsite,
    enriched,
    audited,
    lighthoused,
    aiAnalyzed,
    scored,
    good,
    selected,
    generated,
    failed
  });
});

app.get('/api/discovery/runs/:runId/stats', requireSuperAdmin, async (req: Request, res: Response) => {
  const run = await prisma.discoveryRun.findUnique({ where: { id: String(req.params.runId) }, include: { _count: { select: { leadIds: true } } } });
  if (!run) { res.status(404).json({ error: 'not_found' }); return; }
  res.json(await discovery.getRunFunnel(run.id));
});

app.post('/api/leads/:leadId/redesign', requireSuperAdmin, async (req: Request, res: Response) => {
  const leadId = String(req.params.leadId);
  const stage = typeof req.body?.stage === 'string' ? String(req.body.stage) : '';
  const stages = new Set([
    'NOT_SELECTED', 'SELECTED_FOR_REDESIGN', 'CONTENT_EXTRACTED', 'CONTENT_TRANSFORMED',
    'CMS_IMPORTED', 'SITE_RENDERED', 'AUDIT_DONE', 'DEMO_GENERATED', 'DEMO_APPROVED', 'READY_TO_CONTACT'
  ]);
  if (!stages.has(stage)) {
    res.status(400).json({ error: 'invalid_stage' });
    return;
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { redesignStage: stage as any },
    select: { id: true, redesignStage: true, manualReviewStatus: true }
  });

  res.json({ ok: true, lead: updated });
});

app.post('/api/leads/:leadId/generate', requireSuperAdmin, async (req: Request, res: Response) => {
  const leadId = String(req.params.leadId);
  const template = typeof req.body?.template === 'string' ? req.body.template : 'construction-modern-v1';
  const force = req.body?.force === true;
  try {
    const result = await generateSite({ leadId, templateId: template, force, prisma });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'generation_failed' });
  }
});

app.post('/api/leads/:leadId/review', requireSuperAdmin, async (req: Request, res: Response) => {
  const leadId = String(req.params.leadId);
  const status = typeof req.body?.status === 'string' ? String(req.body.status) : '';
  const note = typeof req.body?.note === 'string' ? String(req.body.note) : null;

  const allowed = new Set(['UNREVIEWED', 'GOOD', 'BAD', 'UNSURE']);
  if (!allowed.has(status)) {
    res.status(400).json({ error: 'invalid_status' });
    return;
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      manualReviewStatus: status as any,
      manualReviewNote: note,
      reviewedAt: status === 'UNREVIEWED' ? null : new Date()
    },
    select: {
      id: true,
      manualReviewStatus: true,
      manualReviewNote: true,
      reviewedAt: true
    }
  });

  res.json({ ok: true, lead: updated });
});

const ALLOWED_AUDIT_FILES = new Set([
  'desktop.png',
  'mobile.png',
  'desktop-full.png',
  'mobile-full.png',
  'crawl.json'
]);

app.get('/audit/:leadId/:file', requireSuperAdmin, async (req: Request, res: Response) => {
  const leadId = String(req.params.leadId);
  const file = String(req.params.file);

  if (!ALLOWED_AUDIT_FILES.has(file)) {
    res.status(400).json({ error: 'file_not_allowed' });
    return;
  }

  const p = path.resolve('data/audit', leadId, file);

  try {
    await fs.access(p);
    res.sendFile(p);
  } catch {
    res.status(404).json({ error: 'not_found' });
  }
});

app.get('/api/discovery/providers', requireSuperAdmin, async (_req: Request, res: Response) => {
  const providers = await discovery.listProviders();
  res.json({ providers });
});

app.get('/api/discovery/providers/:providerId', requireSuperAdmin, async (req: Request, res: Response) => {
  const providers = await discovery.listProviders();
  const p = providers.find((x: any) => x.id === req.params.providerId);
  if (!p) { res.status(404).json({ error: 'not_found' }); return; }
  res.json({ provider: p });
});

app.put('/api/discovery/providers/:providerId/config', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await discovery.updateProviderConfig(String(req.params.providerId), req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/discovery/providers/:providerId/test', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await discovery.testProvider(String(req.params.providerId));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/discovery/presets', requireSuperAdmin, async (_req: Request, res: Response) => {
  const presets = await discovery.listPresets();
  res.json({ presets });
});

app.post('/api/discovery/presets', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const preset = await discovery.createPreset(req.body);
    res.json({ preset });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/discovery/presets/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const preset = await discovery.updatePreset(String(req.params.id), req.body);
    res.json({ preset });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/discovery/presets/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    await discovery.deletePreset(String(req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/discovery/settings', requireSuperAdmin, async (_req: Request, res: Response) => {
  const settings = await discovery.getSettings();
  res.json({ settings });
});

app.put('/api/discovery/settings', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await discovery.setSettings(req.body);
    res.json({ settings });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/discovery/runs', requireSuperAdmin, async (req: Request, res: Response) => {
  const take = Math.min(100, Math.max(1, Number(req.query.take ?? 50)));
  const skip = Math.max(0, Number(req.query.skip ?? 0));
  const result = await discovery.listRuns(take, skip);
  res.json(result);
});

app.get('/api/discovery/runs/:runId', requireSuperAdmin, async (req: Request, res: Response) => {
  const run = await discovery.getRun(String(req.params.runId));
  if (!run) { res.status(404).json({ error: 'not_found' }); return; }
  res.json({ run });
});

app.post('/api/discovery/runs', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { run, warning } = await discovery.start(req.body);
    res.json({ run, warning });
  } catch (err: any) {
    const status = err?.error ? 400 : 500;
    res.status(status).json({ error: err?.error || err?.message || 'discovery_failed' });
  }
});

app.post('/api/discovery/runs/:runId/run-again', requireSuperAdmin, async (req: Request, res: Response) => {
  const existing = await discovery.getRun(String(req.params.runId));
  if (!existing) { res.status(404).json({ error: 'not_found' }); return; }
  const { run, warning } = await discovery.start({
    provider: existing.provider,
    query: existing.query,
    topic: existing.topic ?? undefined,
    location: existing.location ?? undefined,
    limit: existing.limit,
    maxPages: existing.maxPages ?? undefined,
    providerOptions: (existing.providerOptions as Record<string, any>) ?? undefined,
    requestedProvider: existing.provider,
  });
  res.json({ run, warning });
});

app.get('/api/discovery/runs/:runId/duplicate', requireSuperAdmin, async (req: Request, res: Response) => {
  const existing = await discovery.getRun(String(req.params.runId));
  if (!existing) { res.status(404).json({ error: 'not_found' }); return; }
  res.json({
    provider: existing.provider,
    query: existing.query,
    topic: existing.topic,
    location: existing.location,
    limit: existing.limit,
    maxPages: existing.maxPages,
    providerOptions: existing.providerOptions,
  });
});

app.get('/api/operations/definitions', requireSuperAdmin, async (_req: Request, res: Response) => {
  res.json({ operations: operations.getDefinitions() });
});

app.post('/api/operations', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await operations.execute(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/operations', requireSuperAdmin, async (req: Request, res: Response) => {
  const take = Math.min(100, Math.max(1, Number(req.query.take ?? 50)));
  const skip = Math.max(0, Number(req.query.skip ?? 0));
  res.json(await operations.listRuns(take, skip));
});

app.get('/api/operations/:runId', requireSuperAdmin, async (req: Request, res: Response) => {
  const run = await operations.getRun(String(req.params.runId));
  if (!run) { res.status(404).json({ error: 'not_found' }); return; }
  res.json({ run });
});

app.get('/api/operations/:runId/events', requireSuperAdmin, async (req: Request, res: Response) => {
  const events = await operations.listEvents(String(req.params.runId));
  res.json({ events });
});

app.post('/api/operations/:runId/cancel', requireSuperAdmin, async (req: Request, res: Response) => {
  const run = await operations.cancel(String(req.params.runId));
  res.json({ run });
});

app.use('/api/auth', authRouter);
app.use(platformRouter);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[CORE] ready on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
