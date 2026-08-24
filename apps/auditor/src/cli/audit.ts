import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { auditLeadWebsite } from '../pipeline/auditLeadWebsite.js';
import { isBlacklistedWebsiteDomain } from '../websiteFiltering/isBlacklistedWebsiteDomain.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const argsSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  concurrency: z.coerce.number().int().positive().max(5).default(1)
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
    limit: map.get('limit'),
    concurrency: map.get('concurrency')
  });
}

async function main() {
  const runId = randomUUID();
  const startedAt = Date.now();

  const { limit, concurrency } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in environment');
  }

  const prisma = new PrismaClient();

  try {
    const leads = await prisma.lead.findMany({
      where: {
        website: { not: null }
      },
      take: limit,
      orderBy: { updatedAt: 'desc' }
    });

    const candidates = leads.filter((l) => {
      if (!l.websiteDomain) return true;
      return !isBlacklistedWebsiteDomain(l.websiteDomain);
    });

    logger.info(
      {
        runId,
        totalWithWebsite: leads.length,
        candidates: candidates.length,
        skippedByBlacklist: leads.length - candidates.length,
        concurrency
      },
      'audit.start'
    );

    let index = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (index < candidates.length) {
        const i = index++;
        const lead = candidates[i];
        await auditLeadWebsite({ prisma, logger, runId, leadId: lead.id, website: lead.website! });
      }
    });

    await Promise.all(workers);

    logger.info({ runId, durationMs: Date.now() - startedAt }, 'audit.done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'audit.fatal');
  process.exitCode = 1;
});
