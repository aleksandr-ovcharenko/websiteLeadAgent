// wla generate — the single universal generation entry point (V3.7.6).
//
//   npm run generate -- --lead-id=<id>
//   npm run generate -- --url=<source-site-url> [--company=<name>] [--template=<id>]
//   npm run generate -- --run-id=<redesignRunId> [--resume-from=<stage>]
//
// The runner takes NO site id, crawl run id, preview token, route list,
// client name, or prepared CMS payload — every one of those is produced by
// the pipeline itself. `--run-id` is the only resume mechanism: it resolves
// the lead and the next unpassed stage from the run's stored gate contract.
import 'dotenv/config';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { generateSite } from '@minsk/redesign-engine';
import { evaluateWebsiteEligibility } from '../../../collector/src/utils/evaluateWebsiteEligibility.js';
import { STAGE_ORDER } from '../../../../packages/redesign-engine/src/pipeline/stageContract.js';
import { ActivityService } from '../activity/ActivityService.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();
const activity = new ActivityService({ prisma, logger });

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? 'true';
  }
  return args;
}

async function resolveLead(args: Record<string, string>) {
  if (args['lead-id']) {
    const lead = await prisma.lead.findUnique({ where: { id: args['lead-id'] } });
    if (!lead) throw new Error(`Lead not found: ${args['lead-id']}`);
    return lead;
  }
  if (args.url) {
    const eligibility = evaluateWebsiteEligibility(args.url);
    if (!eligibility.eligible || !eligibility.canonicalDomain) {
      throw new Error(`URL is not a direct company website: ${args.url} (${eligibility.reason ?? 'ineligible'})`);
    }
    const canonicalUrl = eligibility.canonicalUrl!;
    const domain = eligibility.canonicalDomain;
    const existing = await prisma.lead.findFirst({
      where: { websiteDomain: domain },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      logger.info({ leadId: existing.id, domain }, 'reusing canonical-domain lead');
      return existing;
    }
    // Deterministic sourceId — a second --url run for the same domain always
    // resolves the same Lead, never a duplicate.
    return prisma.lead.create({
      data: {
        source: 'manual',
        sourceId: `url:${domain}`,
        companyName: args.company ?? domain,
        website: canonicalUrl,
        websiteDomain: domain,
        websiteStatus: 'FOUND',
        manualReviewStatus: 'GOOD',
        manualReviewNote: 'wla generate --url (direct site verified eligible)',
      },
    });
  }
  throw new Error('usage: --lead-id=<id> | --url=<url> | --run-id=<id>');
}

async function resolveResume(args: Record<string, string>) {
  if (!args['run-id']) return {};
  const run = await prisma.redesignRun.findUnique({ where: { id: args['run-id'] } });
  if (!run) throw new Error(`Redesign run not found: ${args['run-id']}`);
  const results = (run.stageResults as any[]) ?? [];
  const lastPassIdx = results.reduce(
    (acc, r) => (r?.status === 'PASS' || r?.status === 'PASS_WITH_WARNINGS' ? Math.max(acc, STAGE_ORDER.indexOf(r.stage)) : acc),
    -1,
  );
  const resumeFrom = (args['resume-from'] as any) ?? STAGE_ORDER[Math.min(lastPassIdx + 1, STAGE_ORDER.length - 1)];
  // Resuming a run must reuse the run row and its crawl artifact — the stage
  // contract continues the SAME run, not a fresh crawl under a new runId.
  return { leadId: run.leadId, resumeFromStage: resumeFrom, crawlRunId: run.id, force: true };
}

async function main() {
  const args = parseArgs(process.argv);
  const resume = await resolveResume(args);
  const lead = resume.leadId ? await prisma.lead.findUnique({ where: { id: resume.leadId } }) : await resolveLead(args);
  if (!lead) throw new Error('Lead resolution failed');

  const result = await generateSite({
    leadId: lead.id,
    templateId: args.template,
    force: args.force === 'true' || resume.force === true,
    // Fresh runs must regenerate: 'retry' is reserved for stage resume and
    // skips stale-content cleanup, which would leave orphaned generated
    // pages/entities routable.
    mode: (args.mode as any) ?? (resume.resumeFromStage ? 'retry' : 'regenerate'),
    resumeFromStage: resume.resumeFromStage as any,
    crawlRunId: resume.crawlRunId as any,
    maxPages: args['max-pages'] ? Number(args['max-pages']) : undefined,
    stageTimeoutMs: args['stage-timeout-ms'] ? Number(args['stage-timeout-ms']) : undefined,
    renderQaBrowser: args['no-browser'] !== 'true',
    prisma,
    onActivity: async (e) => {
      await activity.log({
        level: e.level ?? 'INFO', module: 'FACTORY', eventType: e.eventType,
        message: e.message, leadId: lead.id, details: e.details,
      }).catch(() => undefined);
      logger.info({ eventType: e.eventType, ...e.details }, e.message);
    },
  });

  const site = result.siteId
    ? await prisma.site.findUnique({ where: { id: result.siteId }, include: { revisions: { orderBy: { version: 'desc' }, take: 1 }, screenshot: true } })
    : null;
  const rev = site?.revisions?.[0];
  console.log(JSON.stringify({
    status: 'REVIEW_READY',
    leadId: lead.id,
    runId: result.runId,
    siteId: result.siteId,
    revisionId: result.revisionId,
    revisionVersion: rev?.version,
    previewSlug: result.previewSlug,
    routes: (rev?.routeManifest as any[])?.length ?? 0,
    forgePreview: site?.screenshot?.url ?? null,
    gates: result.stageResults?.map((r: any) => `${r.stage}:${r.status}`),
  }, null, 2));
}

main()
  .catch((e) => { logger.error({ err: e?.message }, 'generate failed'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
