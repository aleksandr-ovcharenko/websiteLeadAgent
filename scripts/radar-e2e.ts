import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const discovery = new DiscoveryService({ prisma, logger, env: process.env });

async function main() {
  const request = {
    provider: 'dgis',
    query: 'ремонт квартир',
    location: 'Минск',
    limit: 5,
    maxPages: 1,
  };

  console.log('Starting Radar E2E discovery', request);
  const onProgress = (msg: string, meta?: any) => console.log(`[${meta?.stage ?? 'progress'}]`, msg);
  const { run, warning } = await discovery.start(request, onProgress);
  console.log('Discovery run', run.id, run.status, warning);

  const funnel = await discovery.getRunFunnel(run.id);
  console.log('Funnel', JSON.stringify(funnel, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
