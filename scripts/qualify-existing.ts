import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';
import { OperationService } from '../apps/dashboard/src/operations/OperationService.js';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const discovery = new DiscoveryService({ prisma, logger, env: process.env });
const operations = new OperationService({ prisma, logger, env: process.env, discovery });

async function main() {
  const runId = process.argv[2] || 'cmth2pcuh0000ljfx2tk7mp0x';
  console.log('Running QUALIFY_DISCOVERY_RUN for', runId);
  const { run } = await operations.execute({
    operationId: 'QUALIFY_DISCOVERY_RUN',
    input: { discoveryRunId: runId, concurrency: 2 },
    entityType: 'DiscoveryRun',
    entityId: runId,
  });
  console.log('Operation started', run.id);

  const poll = setInterval(async () => {
    const latest = await prisma.operationRun.findUnique({ where: { id: run.id } });
    if (!latest) return;
    console.log('Operation', latest.id, latest.status);
    if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(latest.status)) {
      clearInterval(poll);
      const funnel = await discovery.getRunFunnel(runId);
      console.log('Funnel', JSON.stringify(funnel, null, 2));
      await prisma.$disconnect();
    }
  }, 5000);
}

main().catch((e) => { console.error(e); process.exit(1); });
