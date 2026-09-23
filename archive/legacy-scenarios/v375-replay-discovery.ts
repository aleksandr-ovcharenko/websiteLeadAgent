// V3.7.5 Part D — replay of the five affected 2GIS discovery runs.
// Re-runs the SAME queries through the real DiscoveryService (provider →
// contact extraction → enrichment-aware gate), linking each replay to its
// original run via providerOptions.replayedFromRunId. No manual inserts;
// dedup by canonical domain applies as in production.
//
// Qualification is intentionally stubbed: per-lead audits are unchanged by
// this recovery and would add unbounded crawl work; the gating/enrichment
// outcome is the evidence under test.
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { DiscoveryService } from '../apps/dashboard/src/discovery/service.js';
import { ActivityService } from '../apps/dashboard/src/activity/ActivityService.js';

const ORIGINAL_RUN_IDS = [
  'cmud2o75r009vry35m76xow68', // компании строительные — Минск
  'cmud2q20300dvry3506mqqwtq', // генподрядчик — Минск
  'cmud2ro9j00fxry35htbmu2h6', // строительные компании — Минск
  'cmud2s0my00jxry35ncr9p0hl', // строительные компании сайт — Минск
  'cmud2slsj00nbry35wthu4jo2', // ремонт офисов — Минск
];

const prisma = new PrismaClient();
const logger = pino({ level: process.env.LOG_LEVEL ?? 'warn' });
const activity = new ActivityService({ prisma, logger });
const discovery = new DiscoveryService({ prisma, logger, env: process.env, activity });

// Recording no-op orchestrator — see header comment.
discovery.setQualificationOrchestrator({
  resume: async () => ({ ok: true, started: null, reason: 'replay_qualification_skipped' }),
  advance: async () => ({ ok: true, started: null, reason: 'replay_qualification_skipped' }),
} as any);

async function reasonBreakdownFor(runId: string) {
  const rows = await prisma.discoveryCandidate.findMany({
    where: { runId },
    select: { decision: true, reason: true, websiteSource: true, enrichmentAttempts: true, companyName: true, website: true },
  });
  const byReason: Record<string, number> = {};
  const byDecision: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const r of rows) {
    byReason[r.reason ?? 'null'] = (byReason[r.reason ?? 'null'] ?? 0) + 1;
    byDecision[r.decision ?? 'null'] = (byDecision[r.decision ?? 'null'] ?? 0) + 1;
    bySource[r.websiteSource ?? 'none'] = (bySource[r.websiteSource ?? 'none'] ?? 0) + 1;
  }
  return { total: rows.length, byDecision, byReason, bySource, rows };
}

async function replayOne(originalId: string) {
    const original = await prisma.discoveryRun.findUnique({ where: { id: originalId } });
    if (!original) return { originalId, error: 'original run not found' };

    const before = await reasonBreakdownFor(originalId);

    let replayed: any = null;
    let error: string | null = null;
    try {
      const res = await discovery.start({
        provider: original.provider,
        query: original.query,
        location: original.location ?? undefined,
        limit: Math.min(50, original.limit ?? 50),
        maxPages: original.maxPages ?? undefined,
        providerOptions: { replayedFromRunId: originalId },
      });
      replayed = res.run;
      if (res.warning) replayed = { ...replayed, warning: res.warning };
    } catch (e: any) {
      replayed = e?.run ?? null;
      error = e?.error ?? e?.message ?? String(e);
    }

    const after = replayed?.id ? await reasonBreakdownFor(replayed.id) : null;
    const evidence = replayed?.providerOptions as any;

    const entry = {
      originalId,
      replayRunId: replayed?.id ?? null,
      query: original.query,
      location: original.location,
      before: {
        status: original.status, collected: original.collected,
        createdCount: original.createdCount, duplicateCount: original.duplicateCount,
        rejectedCount: original.rejectedCount, uncertainCount: original.uncertainCount,
        reasons: before.byReason,
      },
      after: replayed ? {
        status: replayed.status, collected: replayed.collected,
        createdCount: replayed.createdCount, duplicateCount: replayed.duplicateCount,
        rejectedCount: replayed.rejectedCount, uncertainCount: replayed.uncertainCount,
        reasons: after?.byReason ?? {},
        decisions: after?.byDecision ?? {},
        websiteSources: after?.bySource ?? {},
        providerEvidence: evidence?.evidence ?? null,
        error,
      } : { error },
    };

    logger.warn({ query: original.query, replayRunId: replayed?.id }, 'replay.run.done');
    return entry;
}

async function main() {
  const report: any = { replayedAt: new Date().toISOString(), runs: [] };
  // Runs are independent (separate DiscoveryRun rows; dedup is per-run plus
  // canonical-domain DB checks) — replay them in parallel.
  report.runs = await Promise.all(ORIGINAL_RUN_IDS.map((id) => replayOne(id)));

  await mkdir('data/reports', { recursive: true });
  await writeFile('data/reports/v375-discovery-replay.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.runs.map((r: any) => ({
    query: r.query,
    replayRunId: r.replayRunId,
    before: r.before,
    after: r.after ? { ...r.after, providerEvidence: undefined } : r.after,
  })), null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
