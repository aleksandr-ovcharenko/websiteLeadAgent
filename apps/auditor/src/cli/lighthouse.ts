import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { runLighthouseForLead } from '../lighthouse/runLighthouse.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const argsSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(20)
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
    limit: map.get('limit')
  });
}

async function main() {
  const runId = randomUUID();
  const startedAt = Date.now();

  const { limit } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL in environment');
  }

  const prisma = new PrismaClient();

  try {
    const leads = await prisma.lead.findMany({
      where: {
        auditStatus: 'SUCCESS',
        website: { not: null }
      },
      take: limit,
      orderBy: { updatedAt: 'desc' }
    });

    logger.info({ runId, count: leads.length }, 'lighthouse.start');

    let success = 0;
    let failed = 0;

    for (const lead of leads) {
      try {
        const lh = await runLighthouseForLead({ leadId: lead.id, url: lead.website! });

        await prisma.lighthouseReport.upsert({
          where: { leadId: lead.id },
          create: {
            leadId: lead.id,
            reportPath: lh.reportPath,
            performance: lh.summary.performance,
            accessibility: lh.summary.accessibility,
            seo: lh.summary.seo,
            bestPractices: lh.summary.bestPractices,
            lcp: lh.summary.lcp ?? null,
            cls: lh.summary.cls ?? null,
            inp: lh.summary.inp ?? null,
            fcp: lh.summary.fcp ?? null,
            tbt: lh.summary.tbt ?? null
          },
          update: {
            reportPath: lh.reportPath,
            performance: lh.summary.performance,
            accessibility: lh.summary.accessibility,
            seo: lh.summary.seo,
            bestPractices: lh.summary.bestPractices,
            lcp: lh.summary.lcp ?? null,
            cls: lh.summary.cls ?? null,
            inp: lh.summary.inp ?? null,
            fcp: lh.summary.fcp ?? null,
            tbt: lh.summary.tbt ?? null
          }
        });

        logger.info(
          {
            runId,
            leadId: lead.id,
            performance: lh.summary.performance,
            seo: lh.summary.seo
          },
          'lighthouse.lead.success'
        );

        success++;
      } catch (err) {
        logger.warn({ runId, leadId: lead.id, err }, 'lighthouse.lead.failed');
        failed++;
      }
    }

    logger.info({ runId, success, failed, durationMs: Date.now() - startedAt }, 'lighthouse.done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'lighthouse.fatal');
  process.exitCode = 1;
});
