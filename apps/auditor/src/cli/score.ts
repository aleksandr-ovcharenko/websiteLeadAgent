import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { scoreLead } from '../scoring/scoreLead.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const argsSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(50)
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
    const reports = await prisma.lighthouseReport.findMany({
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: { lead: true }
    });

    logger.info({ runId, count: reports.length }, 'score.start');

    let success = 0;
    let failed = 0;

    for (const r of reports) {
      try {
        const res = await scoreLead({
          leadId: r.leadId,
          lighthouse: r,
          lead: {
            companyName: r.lead.companyName,
            website: r.lead.website,
            websiteDomain: r.lead.websiteDomain,
            phone: r.lead.phone,
            address: r.lead.address
          }
        });

        await prisma.lead.update({
          where: { id: r.leadId },
          data: {
            leadScore: res.leadScore,
            businessScore: res.businessScore,
            websiteQualityScore: res.websiteQualityScore,
            scoreDetails: res.scoreDetails,
            scoredAt: new Date(),
            scoreStatus: 'SUCCESS'
          }
        });

        logger.info({ runId, leadId: r.leadId, leadScore: res.leadScore }, 'score.lead.success');
        success++;
      } catch (err) {
        await prisma.lead.update({
          where: { id: r.leadId },
          data: {
            scoreStatus: 'FAILED'
          }
        });

        logger.warn({ runId, leadId: r.leadId, err }, 'score.lead.failed');
        failed++;
      }
    }

    logger.info({ runId, success, failed, durationMs: Date.now() - startedAt }, 'score.done');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'score.fatal');
  process.exitCode = 1;
});
