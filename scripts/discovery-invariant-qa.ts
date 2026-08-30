import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const discovery = new DiscoveryService({ prisma, logger, env: process.env });

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`INVARIANT FAILED: ${message}`);
}

async function main() {
  const { run } = await discovery.start({
    provider: 'dgis',
    query: 'ремонт квартир',
    location: 'Минск',
    limit: 10,
  });

  const leads = await prisma.lead.findMany({
    where: { id: { in: run.leadIds ?? [] } },
    select: {
      id: true,
      websiteStatus: true,
      websiteIneligibilityReason: true,
    },
  });

  const found = leads.filter((l) => l.websiteStatus === 'FOUND').length;
  const notFound = leads.filter((l) => l.websiteStatus !== 'FOUND').length;

  assert(run.status === 'COMPLETED', `run status should be COMPLETED, got ${run.status}`);
  assert(run.collected === run.createdCount + run.duplicateCount, 'collected must equal new leads + known leads');
  assert(run.collected === leads.length, 'collected must equal linked leads');
  assert(found + notFound === run.collected, 'FOUND + NOT_FOUND must equal collected');
  assert(run.createdCount >= 0, 'new lead count must be non-negative');
  assert(run.duplicateCount >= 0, 'known lead count must be non-negative');

  const apiLeads = await prisma.lead.count({
    where: { id: { in: run.leadIds ?? [] }, websiteStatus: 'FOUND' },
  });
  assert(apiLeads === found, 'Radar-visible count must match FOUND leads');

  console.log(JSON.stringify({
    ok: true,
    runId: run.id,
    status: run.status,
    collected: run.collected,
    createdCount: run.createdCount,
    duplicateCount: run.duplicateCount,
    found,
    notFound,
    apiLeads,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
