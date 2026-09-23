// Manual discovery target — routes a pasted website through the real
// provider → gate → dedup path instead of creating a lead directly.
//   npx tsx scripts/manual-discovery.ts "Example Co|https://acme-build.by/"
import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';
import { ActivityService } from '../apps/dashboard/src/activity/ActivityService.js';
import { OperationService } from '../apps/dashboard/src/operations/OperationService.js';

const prisma = new PrismaClient();
const logger = pino({ level: 'warn' });
const activity = new ActivityService({ prisma, logger });
const discovery = new DiscoveryService({ prisma, logger, env: process.env, activity });
const operations = new OperationService({ prisma, logger, env: process.env, discovery, activity });
discovery.setQualificationOrchestrator(operations.qualification);

async function main() {
  const entries = process.argv[2];
  if (!entries) { console.error('usage: npx tsx scripts/manual-discovery.ts "Name|https://site.by/"'); process.exit(2); }
  const { run } = await discovery.start({ provider: 'manual', query: `manual target: ${entries}`, manualEntries: entries });
  const candidates = await prisma.discoveryCandidate.findMany({ where: { runId: run.id } });
  console.log(JSON.stringify({
    runId: run.id, status: run.status, collected: run.collected,
    created: run.createdCount, duplicates: run.duplicateCount, rejected: run.rejectedCount,
    candidates: candidates.map((c) => ({ decision: c.decision, reason: c.reason, leadId: c.leadId, domain: c.websiteDomain, website: c.website })),
  }, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
