import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { OpenAiVisualAnalysisProvider } from '../visualAnalysis/openAiVisualAnalysisProvider.js';
import { GeminiVisualAnalysisProvider } from '../visualAnalysis/geminiVisualAnalysisProvider.js';
import { runVisualAnalysisForLead } from '../visualAnalysis/runVisualAnalysisForLead.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const argsSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(24),
  concurrency: z.coerce.number().int().positive().max(5).default(2),
  lead: z.string().optional(),
  force: z.coerce.boolean().default(false)
});

type Args = z.infer<typeof argsSchema>;

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();

  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    if (eq === -1) {
      map.set(raw.slice(2), 'true');
      continue;
    }
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);
    map.set(key, value);
  }

  return argsSchema.parse({
    limit: map.get('limit'),
    concurrency: map.get('concurrency'),
    lead: map.get('lead'),
    force: map.get('force')
  });
}

async function main() {
  const runId = randomUUID();
  const startedAt = Date.now();

  const { limit, concurrency, lead, force } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');

  const providerName = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();
  const promptVersion = process.env.VISUAL_PROMPT_VERSION ?? 'v1';

  const model =
    providerName === 'gemini'
      ? process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'
      : process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const provider = (() => {
    if (providerName === 'gemini') {
      if (!process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
      return new GeminiVisualAnalysisProvider({
        apiKey: process.env.GEMINI_API_KEY,
        model,
        promptVersion
      });
    }

    if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
    return new OpenAiVisualAnalysisProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model,
      promptVersion
    });
  })();

  const prisma = new PrismaClient();

  try {
    let leadIds: string[];

    if (lead) {
      leadIds = [lead];
    } else {
      const leads = await prisma.lead.findMany({
        where: { auditStatus: 'SUCCESS', website: { not: null } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { id: true }
      });
      leadIds = leads.map((l) => l.id);
    }

    logger.info({ runId, provider: providerName, model, promptVersion, leadIds: leadIds.length, concurrency, force }, 'visual.batch.start');

    let index = 0;
    let processed = 0;
    let skipped = 0;
    let success = 0;
    let failed = 0;

    const workers = Array.from({ length: concurrency }, async () => {
      while (index < leadIds.length) {
        const i = index++;
        const leadId = leadIds[i];

        try {
          const res = await runVisualAnalysisForLead({
            prisma,
            logger,
            provider,
            promptVersion,
            runId,
            leadId,
            force
          });

          processed++;
          if (res.status === 'SKIPPED') skipped++;
          if (res.status === 'SUCCESS') success++;
          if (res.status === 'FAILED') failed++;
        } catch (err) {
          processed++;
          failed++;
          logger.warn({ runId, leadId, err }, 'visual.lead.failed');
        }
      }
    });

    await Promise.all(workers);

    logger.info(
      {
        runId,
        processed,
        success,
        skipped,
        failed,
        durationMs: Date.now() - startedAt
      },
      'visual.batch.done'
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'visual.fatal');
  process.exitCode = 1;
});
