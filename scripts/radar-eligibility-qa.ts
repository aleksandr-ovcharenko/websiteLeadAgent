import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';
import { enrichLeads } from '../apps/collector/src/enrichment/enrichLeads.js';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const discovery = new DiscoveryService({ prisma, logger, env: process.env });

const cases = [
  { query: 'ремонт квартир', location: 'Минск', limit: 50 },
  { query: 'строительство домов', location: 'Минск', limit: 50 },
];

const blockedPatterns = [
  /ibiz\.by$/,
  /\.ibiz\.by$/,
  /jsprav\.ru$/,
  /\.jsprav\.ru$/,
  /gov\.by$/,
  /\.gov\.by$/,
];

async function analyzeRun(runId: string) {
  const run = await prisma.discoveryRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error('run not found');

  const leads = await prisma.lead.findMany({
    where: { id: { in: run.leadIds ?? [] } },
    select: {
      id: true,
      companyName: true,
      website: true,
      websiteDomain: true,
      websiteStatus: true,
      websiteIneligibilityReason: true,
      sourceUrl: true,
    },
  });

  const total = leads.length;
  const found = leads.filter((l) => l.websiteStatus === 'FOUND');
  const notFound = leads.filter((l) => l.websiteStatus !== 'FOUND');
  const blocked = found.filter((l) => l.websiteDomain && blockedPatterns.some((p) => p.test(l.websiteDomain)));
  const ineligible = found.filter((l) => l.websiteDomain && !blockedPatterns.some((p) => p.test(l.websiteDomain)));

  const byReason: Record<string, number> = {};
  for (const l of notFound) {
    const reason = l.websiteIneligibilityReason ?? 'UNKNOWN';
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }

  const byDomain: Record<string, number> = {};
  for (const l of found) {
    const d = l.websiteDomain ?? 'unknown';
    byDomain[d] = (byDomain[d] ?? 0) + 1;
  }

  const byIneligibleDomain: Record<string, number> = {};
  for (const l of blocked) {
    const d = l.websiteDomain ?? 'unknown';
    byIneligibleDomain[d] = (byIneligibleDomain[d] ?? 0) + 1;
  }

  return {
    query: run.query,
    location: run.location,
    total,
    eligible: ineligible.length,
    blocked: blocked.length,
    noWebsite: notFound.length,
    byReason,
    byDomain,
    byIneligibleDomain,
    sampleBad: blocked.slice(0, 5).map((l) => ({ name: l.companyName, website: l.website, domain: l.websiteDomain })),
    sampleNoWebsite: notFound.slice(0, 5).map((l) => ({ name: l.companyName, reason: l.websiteIneligibilityReason })),
  };
}

async function main() {
  const results = [];

  for (const c of cases) {
    logger.info({ query: c.query }, 'discovery.start');
    const { run } = await discovery.start(c);

    logger.info({ runId: run.id, query: c.query }, 'enrichment.start');
    await enrichLeads({ prisma, logger, runId: run.id, leadIds: run.leadIds ?? [] });
    logger.info({ runId: run.id }, 'enrichment.done');

    const analysis = await analyzeRun(run.id);
    results.push({ runId: run.id, ...analysis });
  }

  const allBlocked = results.flatMap((r) => r.sampleBad);
  const allNoWebsite = results.flatMap((r) => r.sampleNoWebsite);

  console.log(JSON.stringify({ results, allBlocked, allNoWebsite }, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
