import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { z } from 'zod';
import { exportLeads } from '../export/exportLeads.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const argsSchema = z.object({
  outDir: z.string().min(1).default('data/export')
});

type Args = z.infer<typeof argsSchema>;

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();

  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    if (eq === -1) continue;
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);
    map.set(key, value);
  }

  return argsSchema.parse({
    outDir: map.get('outDir')
  });
}

async function main() {
  const { outDir } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in environment');
  }

  const prisma = new PrismaClient();

  try {
    await exportLeads({ prisma, outDir });
    logger.info({ outDir }, 'export.done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'export.fatal');
  process.exitCode = 1;
});
