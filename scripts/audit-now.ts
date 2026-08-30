import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { auditLeadWebsite } from '../apps/auditor/src/pipeline/auditLeadWebsite.js';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { websiteStatus: 'FOUND', auditStatus: { not: 'SUCCESS' } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, companyName: true, website: true, auditStatus: true },
  });

  if (!lead) {
    console.log('No eligible lead with FOUND website and non-SUCCESS audit found');
    await prisma.$disconnect();
    return;
  }

  console.log('Auditing', lead.id, lead.companyName, lead.website);
  await auditLeadWebsite({ prisma, logger, runId: 'audit-now', leadId: lead.id, website: lead.website });

  const after = await prisma.lead.findUnique({ where: { id: lead.id }, select: { auditStatus: true } });
  console.log('Done:', after?.auditStatus);

  const dir = `data/audit/${lead.id}`;
  const fs = await import('node:fs/promises');
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  console.log('Files in', dir, files);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
