import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const discovery = new DiscoveryService({ prisma, logger, env: process.env });

async function main() {
  const cases = [
    { query: 'строительная фирма', location: 'Минск', limit: 50 },
    { query: 'строительство домов', location: 'Минск', limit: 20 },
  ];

  const results = [];

  for (const c of cases) {
    logger.info(c, 'discovery.start');
    const { run } = await discovery.start(c);

    const leads = await prisma.lead.findMany({
      where: { id: { in: run.leadIds ?? [] } },
      select: {
        id: true,
        sourceId: true,
        companyName: true,
        website: true,
        websiteDomain: true,
        websiteStatus: true,
        websiteIneligibilityReason: true,
        createdAt: true,
      },
    });

    const byStatus: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    for (const l of leads) {
      byStatus[l.websiteStatus] = (byStatus[l.websiteStatus] ?? 0) + 1;
      const r = l.websiteIneligibilityReason ?? 'null';
      byReason[r] = (byReason[r] ?? 0) + 1;
    }

    results.push({
      runId: run.id,
      query: run.query,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      collected: run.collected,
      createdCount: run.createdCount,
      duplicateCount: run.duplicateCount,
      leadIdsCount: (run.leadIds ?? []).length,
      leadStatusSummary: byStatus,
      leadReasonSummary: byReason,
      visibleInRadar: leads.filter((l) => l.websiteStatus === 'FOUND').length,
    });
  }

  console.log(JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
