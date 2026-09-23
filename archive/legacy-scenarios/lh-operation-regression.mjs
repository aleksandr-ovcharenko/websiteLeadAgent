import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { OperationService } from '../apps/dashboard/src/operations/OperationService.js';
import { ActivityService } from '../apps/dashboard/src/activity/ActivityService.js';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';
import { execSync } from 'node:child_process';

const prisma = new PrismaClient();
const logger = pino({ level: 'info' });
const activity = new ActivityService({ prisma, logger });
const discovery = new DiscoveryService({ prisma, logger, env: process.env, activity });
const operations = new OperationService({ prisma, logger, env: process.env, discovery, activity });

function chromeCount() {
  try {
    return Number(execSync("ps aux | grep -E '[C]hrome|[c]hromium' | wc -l", { encoding: 'utf-8' }).trim());
  } catch {
    return 0;
  }
}

async function waitForStatus(runId, statuses = new Set(['SUCCESS', 'FAILED', 'CANCELLED', 'INTERRUPTED']), timeout = 300000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const run = await operations.getRun(runId);
    if (run && statuses.has(run.status)) return run;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Run ${runId} did not complete within ${timeout}ms`);
}

const beforeChrome = chromeCount();
console.log('Chrome before:', beforeChrome);

async function testFailure() {
  const lead = await prisma.lead.findFirst({ where: { website: { not: null } }, select: { id: true, website: true } });
  if (!lead) throw new Error('No lead with website');
  const { run } = await operations.execute({
    operationId: 'RUN_LIGHTHOUSE',
    leadId: lead.id,
    input: { leadId: lead.id, url: 'http://localhost:1', maxTimeMs: 10 },
  });
  const completed = await waitForStatus(run.id);
  if (completed.status !== 'FAILED') {
    throw new Error(`Expected FAILED for bad URL, got ${completed.status}`);
  }
  const report = await prisma.lighthouseReport.findUnique({ where: { leadId: lead.id } });
  if (!report || report.status !== 'FAILED') {
    throw new Error('LighthouseReport should be FAILED');
  }
  console.log('FAILURE TEST OK:', completed.status, report.error?.code || report.error?.message);
}

async function testSuccess() {
  const lead = await prisma.lead.findFirst({
    where: { website: { contains: 'mrs.by' } },
    select: { id: true, website: true },
  });
  if (!lead) throw new Error('No mrs.by lead');
  const { run } = await operations.execute({
    operationId: 'RUN_LIGHTHOUSE',
    leadId: lead.id,
    input: { leadId: lead.id, url: lead.website },
  });
  const completed = await waitForStatus(run.id);
  if (completed.status !== 'SUCCESS') {
    throw new Error(`Expected SUCCESS for mrs.by, got ${completed.status}`);
  }
  const report = await prisma.lighthouseReport.findUnique({ where: { leadId: lead.id } });
  if (!report || report.status !== 'SUCCESS') {
    throw new Error('LighthouseReport should be SUCCESS');
  }
  console.log('SUCCESS TEST OK:', completed.status, 'performance', report.performance);
}

try {
  await testFailure();
  await testSuccess();
  const afterChrome = chromeCount();
  console.log('Chrome after:', afterChrome);
  if (afterChrome > beforeChrome + 2) {
    console.warn('Possible Chrome leak:', afterChrome, 'vs', beforeChrome);
  } else {
    console.log('Chrome count acceptable');
  }
  console.log('REGRESSION PASSED');
  process.exit(0);
} catch (err) {
  console.error('REGRESSION FAILED:', err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
