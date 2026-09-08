import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Request, Response } from 'express';
import pino from 'pino';
import { sessionMiddleware, authRouter, requireAuth, requireSuperAdmin } from './auth.js';
import { platformRouter } from './platform.js';
import { generateSite } from '@minsk/redesign-engine';
import { DiscoveryService, listDiscoveryProviders, getDiscoveryProvider, DISCOVERY_PRESETS } from './discovery/index.js';
import { OperationService } from './operations/index.js';
import { ActivityService } from './activity/ActivityService.js';
import { getBulkAiEligibility } from './qualification/bulkAiEligibility.js';

const prisma = new PrismaClient();
const app = express();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const activity = new ActivityService({ prisma, logger });
const discovery = new DiscoveryService({ prisma, logger, env: process.env, activity });
const operations = new OperationService({ prisma, logger, env: process.env, discovery, activity });
discovery.setQualificationOrchestrator(operations.qualification);

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

const LEAD_SELECT =  {
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
      auditErrorMessage: true,
      redesignStage: true,
      updatedAt: true,
      site: {
        select: {
          id: true,
          previewToken: true,
          status: true
        }
      },
      lighthouseReport: {
        select: {
          status: true,
          error: true,
          attempts: true,
          durationMs: true,
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
    };

app.get('/api/leads', requireAuth, async (req: Request, res: Response) => {
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
  const qualificationStatus = typeof req.query.qualificationStatus === 'string' ? req.query.qualificationStatus : 'READY';
  const generationStatus = typeof req.query.generationStatus === 'string' ? req.query.generationStatus : '';
  const includeExcluded = req.query.includeExcluded === '1';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'lead_desc';
  const discoveryRunId = typeof req.query.discoveryRunId === 'string' ? req.query.discoveryRunId : '';

  const orderBy = (() => {
    const stable = [{ id: 'asc' as const }];
    switch (sort) {
      case 'createdAt_desc':
        return [{ createdAt: 'desc' as const }, ...stable];
      case 'createdAt_asc':
        return [{ createdAt: 'asc' as const }, ...stable];
      case 'company_asc':
        return [{ companyName: 'asc' as const }, ...stable];
      case 'company_desc':
        return [{ companyName: 'desc' as const }, ...stable];
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
        return [{ createdAt: 'desc' as const }, ...stable];
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
  } else if (!includeExcluded && qualificationStatus !== 'FAILED') {
    where.websiteStatus = 'FOUND';
  }

  if (enrichmentStatus) {
    where.enrichmentStatus = enrichmentStatus;
  }

  if (auditStatus) {
    where.auditStatus = auditStatus;
  }

  const readyForReviewWhere: any = {
    websiteStatus: 'FOUND',
    auditStatus: 'SUCCESS',
    lighthouseReport: { status: 'SUCCESS' },
    visualAnalysis: { status: 'SUCCESS' },
    scoreStatus: 'SUCCESS',
  };

  if (qualificationStatus === 'READY') {
    Object.assign(where, readyForReviewWhere);
  } else if (qualificationStatus === 'PENDING') {
    where.websiteStatus = 'FOUND';
    where.NOT = readyForReviewWhere;
  } else if (qualificationStatus === 'FAILED') {
    where.OR = FAILED_CHECKS_OR;
  }

  const generationStageMap: Record<string, string[]> = {
    NOT_SELECTED: ['NOT_SELECTED'],
    SELECTED: ['SELECTED_FOR_REDESIGN'],
    GENERATING: ['CRAWL_READY', 'CONTENT_EXTRACTED', 'CONTENT_TRANSFORMED', 'CMS_IMPORTED', 'SITE_RENDERED', 'AUDIT_DONE'],
    GENERATED: ['DEMO_GENERATED', 'DEMO_APPROVED', 'READY_TO_CONTACT'],
    FAILED: ['CRAWL_FAILED'],
  };
  if (generationStatus && generationStatus !== 'ALL') {
    if (generationStatus === 'READY_FOR_GENERATION') {
      where.manualReviewStatus = 'GOOD';
      where.redesignStage = { notIn: ['NOT_SELECTED'] };
    } else if (generationStageMap[generationStatus]) {
      where.redesignStage = { in: generationStageMap[generationStatus] };
    }
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

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
    where,
    orderBy: orderBy as any,
    skip: offset,
    take: limit,
    select: LEAD_SELECT
    }),
    prisma.lead.count({ where }),
  ]);

  const activeOperations = await prisma.operationRun.findMany({
    where: {
      leadId: { in: leads.map((l: any) => l.id) },
      status: { in: ['PENDING', 'RUNNING', 'CANCEL_REQUESTED'] },
    },
    select: { id: true, operationId: true, leadId: true, status: true, createdAt: true },
  });
  const activeByLead = new Map<string, any[]>();
  for (const op of activeOperations) {
    const list = activeByLead.get(op.leadId) || [];
    list.push(op);
    activeByLead.set(op.leadId, list);
  }

  const withReadiness = leads.map((l: any) => ({
    ...l,
    activeOperations: activeByLead.get(l.id) || [],
    readyForReview: !!(
      l.websiteStatus === 'FOUND' &&
      l.auditStatus === 'SUCCESS' &&
      l.lighthouseReport?.status === 'SUCCESS' &&
      l.visualAnalysis?.status === 'SUCCESS' &&
      l.scoreStatus === 'SUCCESS'
    ),
  }));
  res.json({ items: withReadiness, meta: { limit, offset, total, q, sort, discoveryRunId, websiteStatus, enrichmentStatus, qualificationStatus } });
});

// Failed Checks = leads blocked by a terminal technical-stage failure.
// RUNNING/PENDING stages are never counted here.
const FAILED_CHECKS_OR: any[] = [
  { websiteStatus: 'FAILED' },
  { auditStatus: 'FAILED' },
  { scoreStatus: 'FAILED' },
  { visualAnalysis: { status: 'FAILED' } },
  { lighthouseReport: { status: 'FAILED' } },
];

app.get('/api/leads/stats', requireAuth, async (req: Request, res: Response) => {
  const discoveryRunId = typeof req.query.discoveryRunId === 'string' ? req.query.discoveryRunId : '';
  const where: any = {};
  if (discoveryRunId) {
    const run = await prisma.discoveryRun.findUnique({ where: { id: discoveryRunId }, select: { leadIds: true } });
    if (run?.leadIds?.length) where.id = { in: run.leadIds };
    else where.id = { in: [] };
  }
  const readyForReviewWhere: any = {
    websiteStatus: 'FOUND',
    auditStatus: 'SUCCESS',
    lighthouseReport: { status: 'SUCCESS' },
    visualAnalysis: { status: 'SUCCESS' },
    scoreStatus: 'SUCCESS',
  };
  const [
    total,
    withWebsite,
    withoutWebsite,
    enriched,
    audited,
    lighthoused,
    aiAnalyzed,
    scored,
    readyForReview,
    qualificationPending,
    qualificationFailed,
    good,
    selected,
    generated,
    readyForGeneration,
    failed
  ] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, websiteStatus: 'FOUND' } }),
    prisma.lead.count({ where: { ...where, websiteStatus: { in: ['UNKNOWN', 'NOT_FOUND'] } } }),
    prisma.lead.count({ where: { ...where, enrichmentStatus: 'SUCCESS' } }),
    prisma.lead.count({ where: { ...where, auditStatus: 'SUCCESS' } }),
    prisma.lead.count({ where: { ...where, lighthouseReport: { status: 'SUCCESS' } } }),
    prisma.lead.count({ where: { ...where, visualAnalysis: { status: 'SUCCESS' } } }),
    prisma.lead.count({ where: { ...where, scoreStatus: 'SUCCESS' } }),
    prisma.lead.count({ where: { ...where, ...readyForReviewWhere } }),
    prisma.lead.count({ where: { ...where, websiteStatus: 'FOUND', NOT: readyForReviewWhere } }),
    prisma.lead.count({ where: { ...where, OR: FAILED_CHECKS_OR } }),
    prisma.lead.count({ where: { ...where, ...readyForReviewWhere, manualReviewStatus: 'GOOD' } }),
    prisma.lead.count({ where: { ...where, redesignStage: 'SELECTED_FOR_REDESIGN' } }),
    prisma.lead.count({ where: { ...where, site: { isNot: null } } }),
    prisma.lead.count({ where: { ...where, manualReviewStatus: 'GOOD', redesignStage: { notIn: ['NOT_SELECTED'] } } }),
    prisma.lead.count({ where: { ...where, OR: FAILED_CHECKS_OR } })
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
    readyForReview,
    qualificationPending,
    qualificationFailed,
    good,
    selected,
    generated,
    readyForGeneration,
    failed
  });
});

app.get('/api/discovery/runs/:runId/stats', requireSuperAdmin, async (req: Request, res: Response) => {
  const run = await prisma.discoveryRun.findUnique({ where: { id: String(req.params.runId) }, include: { _count: { select: { leadIds: true } } } });
  if (!run) { res.status(404).json({ error: 'not_found' }); return; }
  res.json(await discovery.getRunFunnel(run.id));
});

// Delta recovery for SSE gaps: returns only entities changed since the
// client's cursor — never the whole view.
app.get('/api/leads/changes', requireAuth, async (req: Request, res: Response) => {
  const since = Number(req.query.since);
  const where: any = Number.isFinite(since) && since > 0 ? { updatedAt: { gt: new Date(since) } } : {};
  const items = await prisma.lead.findMany({ where, select: LEAD_SELECT, take: 200, orderBy: { updatedAt: 'asc' } });
  res.json({ items });
});

app.get('/api/leads/:leadId', requireAuth, async (req: Request, res: Response) => {
  const leadId = String(req.params.leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: LEAD_SELECT });
  if (!lead) { res.status(404).json({ error: 'lead_not_found' }); return; }
  const activeOperations = await prisma.operationRun.findMany({
    where: { leadId, status: { in: ['PENDING', 'RUNNING', 'CANCEL_REQUESTED'] } },
    select: { id: true, operationId: true, leadId: true, status: true, createdAt: true },
  });
  const l: any = lead;
  res.json({
    lead: {
      ...l,
      activeOperations,
      readyForReview: !!(
        l.websiteStatus === 'FOUND' &&
        l.auditStatus === 'SUCCESS' &&
        l.lighthouseReport?.status === 'SUCCESS' &&
        l.visualAnalysis?.status === 'SUCCESS' &&
        l.scoreStatus === 'SUCCESS'
      ),
    },
  });
});

// Delete follows the existing data contract: lead-owned records cascade
// (queries, reports, analyses, redesign runs); any generated Site survives —
// Site.leadId is SetNull, CMS content is never deleted here.
app.delete('/api/leads/:leadId', requireSuperAdmin, async (req: Request, res: Response) => {
  const leadId = String(req.params.leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, companyName: true, site: { select: { id: true } } } });
  if (!lead) { res.status(404).json({ error: 'lead_not_found' }); return; }
  await prisma.lead.delete({ where: { id: leadId } });
  await activity.log({
    level: 'INFO', module: 'RADAR', eventType: 'lead_deleted',
    message: `Lead deleted: ${lead.companyName}`,
    leadId,
    details: { hadSite: !!lead.site },
  }).catch(() => {});
  res.json({ ok: true, detachedSiteId: lead.site?.id ?? null });
});

// Bulk row actions. Per-item results: success | skipped | failed. A human
// bulk decision uses the same review semantics as the single-lead path —
// approve persists GOOD but technical readiness gating is never bypassed.
app.post('/api/leads/bulk', requireSuperAdmin, async (req: Request, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => typeof x === 'string') : [];
  const action = typeof req.body?.action === 'string' ? req.body.action : '';
  if (!ids.length || !['reaudit', 'runAi', 'approve', 'reject', 'delete'].includes(action)) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  if (ids.length > 200) { res.status(400).json({ error: 'too_many_ids' }); return; }

  const results: { id: string; result: 'success' | 'skipped' | 'failed'; reason?: string }[] = [];

  for (const leadId of ids) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, website: true, websiteStatus: true, manualReviewStatus: true, auditStatus: true, visualAnalysis: { select: { status: true } }, site: { select: { id: true } } },
      });
      if (!lead) { results.push({ id: leadId, result: 'skipped', reason: 'not_found' }); continue; }

      if (action === 'reaudit') {
        if (!lead.website) { results.push({ id: leadId, result: 'skipped', reason: 'no_website' }); continue; }
        const active = await prisma.operationRun.findFirst({ where: { leadId, status: { in: ['PENDING', 'RUNNING', 'CANCEL_REQUESTED'] }, operationId: 'AUDIT_WEBSITE' }, select: { id: true } });
        if (active) { results.push({ id: leadId, result: 'skipped', reason: 'audit_running' }); continue; }
        // Re-audit = recovery path: a FAILED website gets one fresh viability
        // attempt; audit stage resets so qualification can advance again.
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            auditStatus: 'PENDING',
            auditErrorMessage: null,
            ...(lead.websiteStatus === 'FAILED' ? { websiteStatus: 'FOUND' } : {}),
          },
        });
        const { run } = await operations.execute({ operationId: 'AUDIT_WEBSITE', input: { leadId, website: lead.website }, leadId });
        results.push({ id: leadId, result: 'success', reason: run?.id });
      } else if (action === 'approve') {
        if (lead.manualReviewStatus === 'GOOD') { results.push({ id: leadId, result: 'skipped', reason: 'already_good' }); continue; }
        await prisma.lead.update({ where: { id: leadId }, data: { manualReviewStatus: 'GOOD', reviewedAt: new Date() } });
        results.push({ id: leadId, result: 'success' });
      } else if (action === 'reject') {
        await prisma.lead.update({ where: { id: leadId }, data: { manualReviewStatus: 'BAD', reviewedAt: new Date() } });
        const cancelled = await operations.cancelForLead(leadId);
        results.push({ id: leadId, result: 'success', reason: cancelled.length ? `cancelled ${cancelled.length} run(s)` : undefined });
      } else if (action === 'runAi') {
        const active = await prisma.operationRun.findMany({
          where: { leadId, status: { in: ['PENDING', 'RUNNING', 'CANCEL_REQUESTED'] }, operationId: 'RUN_VISUAL_ANALYSIS' },
          select: { operationId: true },
        });
        const eligibility = getBulkAiEligibility(lead, active);
        if (eligibility.result !== 'STARTED') {
          results.push({ id: leadId, result: 'skipped', reason: eligibility.reason });
          continue;
        }
        const { run } = await operations.execute({ operationId: 'RUN_VISUAL_ANALYSIS', input: { leadId, force: true }, leadId });
        results.push({ id: leadId, result: 'success', reason: run?.id });
      } else { // delete
        await prisma.lead.delete({ where: { id: leadId } });
        results.push({ id: leadId, result: 'success', reason: lead.site ? `site ${lead.site.id} detached` : undefined });
      }
    } catch (e: any) {
      results.push({ id: leadId, result: 'failed', reason: e?.message || 'error' });
    }
  }

  await activity.log({
    level: 'INFO', module: 'RADAR', eventType: `leads_bulk_${action}`,
    message: `Bulk ${action}: ${results.filter(r => r.result === 'success').length}/${ids.length} succeeded`,
    details: { ids, results },
  }).catch(() => {});

  res.json({ ok: true, action, results });
});

app.post('/api/leads/:leadId/redesign', requireAuth, async (req: Request, res: Response) => {
  const leadId = String(req.params.leadId);
  const stage = typeof req.body?.stage === 'string' ? String(req.body.stage) : '';
  const stages = new Set([
    'NOT_SELECTED', 'SELECTED_FOR_REDESIGN', 'CRAWL_READY', 'CRAWL_FAILED', 'CONTENT_EXTRACTED',
    'CONTENT_TRANSFORMED', 'CMS_IMPORTED', 'SITE_RENDERED', 'AUDIT_DONE', 'DEMO_GENERATED', 'DEMO_APPROVED', 'READY_TO_CONTACT'
  ]);
  if (!stages.has(stage)) {
    res.status(400).json({ error: 'invalid_stage' });
    return;
  }

  // Early human review never bypasses automated gates: moving a lead into
  // the generation pipeline requires both a GOOD review and completed
  // automated qualification. Deselecting (NOT_SELECTED) stays unrestricted.
  if (stage !== 'NOT_SELECTED') {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        manualReviewStatus: true,
        websiteStatus: true,
        auditStatus: true,
        scoreStatus: true,
        lighthouseReport: { select: { status: true } },
        visualAnalysis: { select: { status: true } },
      }
    });
    const ready = !!(
      lead?.websiteStatus === 'FOUND' &&
      lead?.auditStatus === 'SUCCESS' &&
      lead?.lighthouseReport?.status === 'SUCCESS' &&
      lead?.visualAnalysis?.status === 'SUCCESS' &&
      lead?.scoreStatus === 'SUCCESS'
    );
    if (lead?.manualReviewStatus !== 'GOOD') {
      res.status(400).json({ error: 'requires_good_review' });
      return;
    }
    if (!ready) {
      res.status(400).json({ error: 'qualification_incomplete' });
      return;
    }
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
  const crawlRunId = typeof req.body?.crawlRunId === 'string' ? req.body.crawlRunId : undefined;
  try {
    const result = await generateSite({ leadId, templateId: template, force, crawlRunId, mode: 'regenerate', prisma });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'generation_failed' });
  }
});

app.post('/api/leads/:leadId/review', requireAuth, async (req: Request, res: Response) => {
  const leadId = String(req.params.leadId);
  const status = typeof req.body?.status === 'string' ? String(req.body.status) : '';
  const note = typeof req.body?.note === 'string' ? String(req.body.note) : null;

  const allowed = new Set(['UNREVIEWED', 'GOOD', 'BAD', 'UNSURE']);
  if (!allowed.has(status)) {
    res.status(400).json({ error: 'invalid_status' });
    return;
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      websiteStatus: true,
      auditStatus: true,
      scoreStatus: true,
      manualReviewStatus: true,
      lighthouseReport: { select: { id: true, status: true, error: true, attempts: true, durationMs: true } },
      visualAnalysis: { select: { status: true } },
    }
  });
  if (!lead) {
    res.status(404).json({ error: 'lead_not_found' });
    return;
  }

  const isReadyForReview = !!(
    lead.websiteStatus === 'FOUND' &&
    lead.auditStatus === 'SUCCESS' &&
    lead.lighthouseReport?.status === 'SUCCESS' &&
    lead.visualAnalysis?.status === 'SUCCESS' &&
    lead.scoreStatus === 'SUCCESS'
  );

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

  // Early human rejection saves compute: BAD stops all further qualification
  // work for this lead. Queued runs are cancelled before they start; running
  // runs get a cooperative cancellation flag and are marked CANCELLED when
  // they exit — no shared browser/worker infrastructure is killed.
  let cancelledRunIds: string[] = [];
  if (status === 'BAD') {
    cancelledRunIds = await operations.cancelForLead(leadId);
  }
  // A review decision is Radar-visible lead state — always emit so live UIs
  // reconcile promptly, not just when operations were cancelled.
  await activity.log({
    level: 'INFO',
    module: 'RADAR',
    eventType: cancelledRunIds.length > 0 ? 'lead_review_stopped_qualification' : 'lead_reviewed',
    message: cancelledRunIds.length > 0
      ? `Manual BAD review stopped ${cancelledRunIds.length} active qualification operation(s)`
      : `Lead reviewed: ${status}`,
    leadId,
    details: { status, cancelledRunIds, early: !isReadyForReview },
  }).catch(() => {});

  res.json({ ok: true, lead: updated, early: !isReadyForReview, cancelledRunIds });
});

const ALLOWED_AUDIT_FILES = new Set([
  'desktop.png',
  'mobile.png',
  'desktop-full.png',
  'mobile-full.png',
  'crawl.json'
]);

app.get('/audit/:leadId/:file', requireAuth, async (req: Request, res: Response) => {
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

app.get('/api/activity', requireSuperAdmin, async (req: Request, res: Response) => {
  const result = await activity.history({
    limit: numParam(req.query.limit, 200),
    before: typeof req.query.before === 'string' ? req.query.before : undefined,
    level: typeof req.query.level === 'string' ? req.query.level : undefined,
    levelGte: req.query.levelGte as any,
    module: typeof req.query.module === 'string' ? req.query.module : undefined,
    runId: typeof req.query.runId === 'string' ? req.query.runId : undefined,
    leadId: typeof req.query.leadId === 'string' ? req.query.leadId : undefined,
    siteId: typeof req.query.siteId === 'string' ? req.query.siteId : undefined,
    demoVariantId: typeof req.query.demoVariantId === 'string' ? req.query.demoVariantId : undefined,
  });
  res.json(result);
});

app.get('/api/activity/stream', requireSuperAdmin, async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event: any) => {
    if (event?.id) res.write(`id: ${event.id}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const last = req.headers['last-event-id'] as string | undefined;
  if (!last) {
    const { items } = await activity.history({ limit: 50 });
    for (const event of items) send(event);
  } else {
    // Resume: replay persisted events after the client's last cursor.
    const { items } = await activity.history({ limit: 200 });
    const seen = items.findIndex((e: any) => e.id === last);
    const replay = seen >= 0 ? items.slice(seen + 1) : items; // cursor lost → replay window; client filters by revision
    for (const event of replay) send(event);
  }

  const unsubscribe = activity.subscribe(send);

  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });

  res.on('error', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.use('/api/auth', authRouter);
app.use(platformRouter);

app.listen(PORT, async () => {
  // eslint-disable-next-line no-console
  console.log(`[CORE] ready on http://localhost:${PORT}`);
  await operations.reconcileAll();
  const { checkBrowserReadiness } = await import('./activity/browserCheck.js');
  const browser = await checkBrowserReadiness();
  if (!browser.ok) {
    await activity.error({
      module: 'SYSTEM',
      eventType: 'BROWSER_UNAVAILABLE',
      message: browser.friendlyMessage,
      details: { action: browser.action, rawMessage: browser.rawMessage },
      error: new Error(browser.rawMessage),
    });
    logger.error({ error: browser.rawMessage }, 'Browser check failed');
  } else {
    await activity.info({
      module: 'SYSTEM',
      eventType: 'BROWSER_READY',
      message: 'Chromium browser is available.',
    });
  }

  await activity.cleanup();
  setInterval(() => activity.cleanup(), 1000 * 60 * 60);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
