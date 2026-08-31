import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { createRegistry } from '../apps/dashboard/src/operations/registry.js';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const env = process.env;

const ctx = {
  runId: 'recalc-batch',
  stage: async (_name: string, _msg: string, _meta?: any) => {},
  success: async (_msg: string, _meta?: any) => {},
  info: async (_msg: string, _meta?: any) => {},
  warn: async (_msg: string, _meta?: any) => {},
  log: async (_level: string, _msg: string, _meta?: any) => {},
  operationRunId: 'recalc-batch',
};

async function main() {
  const registry = createRegistry({ prisma, logger, env, discovery: null as any });
  const leads = await prisma.lead.findMany({
    where: {
      websiteStatus: 'FOUND',
      auditStatus: 'SUCCESS',
      lighthouseReport: { isNot: null },
      visualAnalysis: { status: 'SUCCESS' },
    },
    select: { id: true },
  });
  console.log(`Recalculating ${leads.length} leads`);
  for (const lead of leads) {
    try {
      const result = await registry.RECALCULATE_SCORE.handler(ctx as any, { leadId: lead.id });
      console.log('Recalculated', lead.id, result.score);
    } catch (e: any) {
      console.error('Failed', lead.id, e.message);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
