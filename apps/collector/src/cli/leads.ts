import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { collect2gisLeads } from '../collector/collect2gisLeads.js';
import { enrichLeads } from '../enrichment/enrichLeads.js';
import { exportLeads } from '../export/exportLeads.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const argsSchema = z.object({
  city: z.string().min(1),
  query: z.string().min(1),
  limit: z.coerce.number().int().positive().max(50).default(50)
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

  const parsed = argsSchema.parse({
    city: map.get('city'),
    query: map.get('query'),
    limit: map.get('limit')
  });

  return parsed;
}

async function main() {
  const runId = randomUUID();
  const startedAt = Date.now();

  const { city, query, limit } = parseArgs(process.argv.slice(2));

  if (!process.env.DGIS_API_KEY) {
    throw new Error('Missing DGIS_API_KEY in environment');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in environment');
  }

  const prisma = new PrismaClient();

  try {
    logger.info({ runId, city, query, limit }, 'collector.start');

    const result = await collect2gisLeads({
      prisma,
      logger,
      runId,
      city,
      query,
      limit,
      apiKey: process.env.DGIS_API_KEY
    });

    await enrichLeads({ prisma, logger, runId, leadIds: result.leadIds });

    await exportLeads({ prisma, outDir: 'output' });

    logger.info(
      {
        runId,
        query,
        collected: result.collected,
        new: result.created,
        duplicates: result.duplicates,
        durationMs: Date.now() - startedAt
      },
      'collector.done'
    );

    process.exitCode = 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'collector.fatal');
  process.exitCode = 1;
});
