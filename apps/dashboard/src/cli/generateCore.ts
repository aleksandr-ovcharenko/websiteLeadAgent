// wla generate — testable core (V3.7.6.1).
//
// Pure-ish functions extracted from the executable wrapper so the lead
// resolution, qualification gate and resume contract are unit-testable with a
// mocked Prisma client — no shell, no live DB.
import { evaluateWebsiteEligibility } from '../../../collector/src/utils/evaluateWebsiteEligibility.js';
import { STAGE_ORDER } from '../../../../packages/redesign-engine/src/pipeline/stageContract.js';

/** Thrown when a lead exists but is not cleared for generation. Generation
 *  never proceeds for a non-GOOD lead — the CLI surfaces the leadId so a human
 *  (or the qualification workflow result) can legitimately move it to GOOD. */
export class LeadReviewRequiredError extends Error {
  leadId: string;
  qualification: string;
  constructor(leadId: string, qualification: string) {
    super(`LEAD_REVIEW_REQUIRED leadId=${leadId} qualification=${qualification}`);
    this.name = 'LeadReviewRequiredError';
    this.leadId = leadId;
    this.qualification = qualification;
  }
}

export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? 'true';
  }
  return args;
}

type PrismaLike = {
  lead: {
    findUnique(arg: any): Promise<any>;
    findFirst(arg: any): Promise<any>;
    upsert(arg: any): Promise<any>;
  };
  redesignRun: {
    findUnique(arg: any): Promise<any>;
  };
};

/** A lead is actionable only while mergeStatus = NONE and archivedAt is null.
 *  MERGED rows are followed to their survivor (bounded chain walk). */
async function followMergeSurvivor(prisma: PrismaLike, lead: any): Promise<any | null> {
  let cursor: any = lead;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    if (cursor.mergeStatus === 'NONE' && !cursor.archivedAt) return cursor;
    seen.add(cursor.id);
    if (!cursor.mergedIntoLeadId) return null;
    cursor = await prisma.lead.findUnique({ where: { id: cursor.mergedIntoLeadId } });
  }
  return null;
}

/** Canonical lead for a domain: actionable row first; otherwise a MERGED row
 *  resolved to its survivor. An archived or merged row is never returned as
 *  the canonical lead. */
export async function findCanonicalLeadByDomain(prisma: PrismaLike, domain: string): Promise<any | null> {
  const actionable = await prisma.lead.findFirst({
    where: { websiteDomain: domain, mergeStatus: 'NONE', archivedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (actionable) return actionable;
  const merged = await prisma.lead.findFirst({
    where: { websiteDomain: domain, mergedIntoLeadId: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  if (!merged) return null;
  return followMergeSurvivor(prisma, merged);
}

export async function resolveLead(args: Record<string, string>, deps: { prisma: PrismaLike; log?: (msg: string, extra?: any) => void }) {
  const { prisma, log } = deps;
  if (args['lead-id']) {
    const lead = await prisma.lead.findUnique({ where: { id: args['lead-id'] } });
    if (!lead) throw new Error(`Lead not found: ${args['lead-id']}`);
    // An explicit id that points at a merged/archived row resolves to the
    // survivor — generation never targets a non-canonical lead.
    const canonical = await followMergeSurvivor(prisma, lead);
    if (!canonical) throw new Error(`Lead ${args['lead-id']} is merged/archived with no live survivor`);
    if (canonical.id !== lead.id) log?.('lead resolved to merge survivor', { requested: lead.id, canonical: canonical.id });
    return canonical;
  }
  if (args.url) {
    const eligibility = evaluateWebsiteEligibility(args.url);
    if (!eligibility.eligible || !eligibility.canonicalDomain) {
      throw new Error(`URL is not a direct company website: ${args.url} (${eligibility.reason ?? 'ineligible'})`);
    }
    const canonicalUrl = eligibility.canonicalUrl!;
    const domain = eligibility.canonicalDomain;
    const existing = await findCanonicalLeadByDomain(prisma, domain);
    if (existing) {
      log?.('reusing canonical-domain lead', { leadId: existing.id, domain });
      return existing;
    }
    // Deterministic sourceId + upsert: a second/concurrent --url run for the
    // same domain always resolves the same Lead, never a duplicate. The row is
    // created UNREVIEWED — URL eligibility only proves DIRECT_COMPANY_SITE, it
    // is NOT a GOOD review. The upsert update deliberately never touches
    // manualReviewStatus so a human GOOD decision is preserved.
    const lead = await prisma.lead.upsert({
      where: { source_sourceId: { source: 'manual', sourceId: `url:${domain}` } },
      create: {
        source: 'manual',
        sourceId: `url:${domain}`,
        companyName: args.company ?? domain,
        city: args.city ?? '',
        website: canonicalUrl,
        websiteDomain: domain,
        websiteStatus: 'FOUND',
        manualReviewNote: 'wla generate --url (direct site eligible; qualification required)',
      },
      update: { website: canonicalUrl, websiteDomain: domain },
    });
    const canonical = await followMergeSurvivor(prisma, lead);
    if (!canonical) throw new Error(`Lead for ${domain} is merged/archived with no live survivor`);
    return canonical;
  }
  throw new Error('usage: --lead-id=<id> | --url=<url> | --run-id=<id>');
}

export interface ResolvedResume {
  leadId?: string;
  resumeFromStage?: string;
  crawlRunId?: string;
  force?: boolean;
}

/** Resume contract: the SAME run row continues — its crawl artifact is reused
 *  (crawlRunId = run.id), the next stage is the first unpassed one, and prior
 *  gate history is preserved by the pipeline's stage-results merge. */
export async function resolveResume(args: Record<string, string>, deps: { prisma: PrismaLike }): Promise<ResolvedResume> {
  if (!args['run-id']) return {};
  const run = await deps.prisma.redesignRun.findUnique({ where: { id: args['run-id'] } });
  if (!run) throw new Error(`Redesign run not found: ${args['run-id']}`);
  const results = (run.stageResults as any[]) ?? [];
  const lastPassIdx = results.reduce(
    (acc, r) => (r?.status === 'PASS' || r?.status === 'PASS_WITH_WARNINGS' ? Math.max(acc, STAGE_ORDER.indexOf(r.stage)) : acc),
    -1,
  );
  const resumeFrom = (args['resume-from'] as any) ?? STAGE_ORDER[Math.min(lastPassIdx + 1, STAGE_ORDER.length - 1)];
  return { leadId: run.leadId, resumeFromStage: resumeFrom, crawlRunId: run.id, force: true };
}

/** The qualification gate. A non-GOOD lead never generates: the real
 *  qualification workflow (QualificationOrchestrator.advance) is driven to
 *  completion while the CLI is alive — ops execute in-process and chain via
 *  the OperationService completion hook, so exiting immediately would orphan
 *  a PENDING run. When the chain goes idle (ready for review or blocked),
 *  the CLI stops with LEAD_REVIEW_REQUIRED carrying the leadId. A human
 *  review moves the lead to GOOD; a rerun then proceeds. */
export async function ensureQualified(
  lead: { id: string; manualReviewStatus?: string | null },
  deps: {
    qualification?: { advance(leadId: string): Promise<any> };
    prisma?: { operationRun: { findFirst(arg: any): Promise<any> } };
    pollMs?: number;
    maxPolls?: number;
    onProgress?: (msg: string) => void;
  },
): Promise<void> {
  if (lead.manualReviewStatus === 'GOOD') return;
  let qualification = 'unavailable';
  const prisma = deps.prisma;
  const qualificationRunner = deps.qualification;
  if (qualificationRunner) {
    try {
      let r = await qualificationRunner.advance(lead.id);
      const pollMs = deps.pollMs ?? 10_000;
      const maxPolls = deps.maxPolls ?? 360; // ~60 min default budget
      for (let i = 0; i < maxPolls && r?.ok && r?.started; i++) {
        await new Promise((res) => setTimeout(res, pollMs));
        const active = prisma
          ? await prisma.operationRun.findFirst({
              where: { leadId: lead.id, status: { in: ['PENDING', 'RUNNING', 'CANCEL_REQUESTED'] } },
            })
          : null;
        if (active) {
          deps.onProgress?.(`qualification ${active.operationId} ${active.status}`);
          continue;
        }
        r = await qualificationRunner.advance(lead.id);
      }
      qualification = r?.readyForReview
        ? 'ready_for_review'
        : r?.ok === false
          ? `blocked:${r.reason ?? 'unknown'}`
          : r?.started
            ? 'still_running'
            : `not_started:${r?.reason ?? 'unknown'}`;
    } catch {
      qualification = 'failed';
    }
  }
  throw new LeadReviewRequiredError(lead.id, qualification);
}
