import 'dotenv/config';
import path from 'node:path';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import { SecurityAuditService } from '../apps/dashboard/src/security/audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  const service = new SecurityAuditService({ prisma, logger, repoRoot });
  const { results, gate } = await service.runAll();
  logger.info({ scans: results.length, last: results[results.length - 1]?.status }, 'security.audit.run');
  logger.info(gate, 'security.gate');
  console.log(JSON.stringify({ scans: results.length, gate }, null, 2));
}

main()
  .catch((e) => {
    logger.error(e, 'security.audit.script.failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
