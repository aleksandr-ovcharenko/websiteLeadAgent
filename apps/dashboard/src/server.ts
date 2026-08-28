import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Request, Response } from 'express';

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT ?? 3333);

function numParam(v: unknown, fallback: number) {
  const n = typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

app.get('/', async (_req: Request, res: Response) => {
  res.type('html').sendFile(path.resolve('apps/dashboard/src/index.html'));
});

app.get('/api/leads', async (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Math.floor(numParam(req.query.limit, 50))));
  const offset = Math.max(0, Math.floor(numParam(req.query.offset, 0)));
  const minLead = numParam(req.query.minLead, 0);
  const minBiz = numParam(req.query.minBiz, 0);
  const maxWeb = numParam(req.query.maxWeb, 100);
  const minV2 = numParam(req.query.minV2, 0);
  const maxV2 = numParam(req.query.maxV2, 100);
  const aiStatus = typeof req.query.aiStatus === 'string' ? req.query.aiStatus : '';
  const manual = typeof req.query.manual === 'string' ? req.query.manual : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'lead_desc';

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

  const where: any = {
    leadScore: { not: null, gte: minLead },
    businessScore: { not: null, gte: minBiz },
    websiteQualityScore: { not: null, lte: maxWeb }
  };

  if (Number.isFinite(minV2) || Number.isFinite(maxV2)) {
    where.leadScoreV2 = { not: null, gte: minV2, lte: maxV2 };
  }

  if (aiStatus) {
    where.visualAnalysis = { status: aiStatus };
  }

  if (manual) {
    where.manualReviewStatus = manual;
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
      website: true,
      websiteDomain: true,
      phone: true,
      address: true,
      leadScore: true,
      businessScore: true,
      websiteQualityScore: true,
      technicalQualityScore: true,
      visualQualityScore: true,
      businessConfidenceScore: true,
      leadScoreV2: true,
      manualReviewStatus: true,
      manualReviewNote: true,
      reviewedAt: true,
      redesignStage: true,
      site: {
        select: {
          id: true,
          previewSlug: true,
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

  res.json({ items: leads, meta: { limit, offset, q, sort } });
});

app.post('/api/leads/:leadId/redesign', async (req: Request, res: Response) => {
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

app.post('/api/leads/:leadId/review', async (req: Request, res: Response) => {
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

app.get('/audit/:leadId/:file', async (req: Request, res: Response) => {
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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard running: http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
