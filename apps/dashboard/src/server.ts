import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Request, Response } from 'express';

const prisma = new PrismaClient();
const app = express();

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
  const minLead = numParam(req.query.minLead, 0);
  const minBiz = numParam(req.query.minBiz, 0);
  const maxWeb = numParam(req.query.maxWeb, 100);

  const leads = await prisma.lead.findMany({
    where: {
      leadScore: { not: null, gte: minLead },
      businessScore: { not: null, gte: minBiz },
      websiteQualityScore: { not: null, lte: maxWeb }
    } as any,
    orderBy: { leadScore: 'desc' } as any,
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
      lighthouseReport: {
        select: {
          performance: true,
          seo: true,
          accessibility: true,
          bestPractices: true
        }
      }
    } as any
  });

  res.json({ items: leads });
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
