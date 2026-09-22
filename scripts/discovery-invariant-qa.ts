import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';
import { ActivityService } from '../apps/dashboard/src/activity/ActivityService.js';
import { OperationService } from '../apps/dashboard/src/operations/OperationService.js';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const activity = new ActivityService({ prisma, logger });
const discovery = new DiscoveryService({ prisma, logger, env: process.env, activity });
const operations = new OperationService({ prisma, logger, env: process.env, discovery, activity });
discovery.setQualificationOrchestrator(operations.qualification);

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
  // Gate contract: every collected candidate is accounted for exactly once —
  // created (new lead), duplicate (attached to an existing lead), rejected
  // (ineligible site/ownership/relevance) or uncertain (needs human review).
  assert(
    run.collected === run.createdCount + run.duplicateCount + (run.rejectedCount ?? 0) + (run.uncertainCount ?? 0),
    `collected (${run.collected}) must equal created + duplicates + rejected + uncertain`,
  );
  // run.leadIds only lists newly created leads; rejected/duplicate candidates
  // stay inspectable through DiscoveryCandidate rows linked to the run.
  assert(run.createdCount === leads.length, 'createdCount must equal linked leads');
  assert(found + notFound === run.createdCount, 'FOUND + NOT_FOUND must equal created leads');
  assert(run.createdCount >= 0, 'new lead count must be non-negative');
  assert(run.duplicateCount >= 0, 'known lead count must be non-negative');

  const candidateCount = await prisma.discoveryCandidate.count({ where: { runId: run.id } });
  assert(candidateCount === run.collected, 'every collected candidate must be recorded in history');

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
    rejectedCount: run.rejectedCount,
    uncertainCount: run.uncertainCount,
    candidateCount,
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
