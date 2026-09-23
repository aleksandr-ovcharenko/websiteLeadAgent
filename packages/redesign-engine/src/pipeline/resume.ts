// Resume & canonical-resolution contract (V3.7.6.1).
//
// Extracted from generateSite so the resume rules are unit-testable:
//  - resume reuses the SAME RedesignRun row and its crawlJsonPath artifact;
//    no recrawl ever happens for a resumed run;
//  - a re-run stage replaces its prior gate result (no duplicates) while the
//    rest of the persisted history is preserved;
//  - an ARCHIVED or merged Site is never the resume/generation target — the
//    canonical site is resolved by domain;
//  - the preferred ACTIVE variant is resolved from the DB on resume.
import { readFile } from 'fs/promises';
import type { StageGateResult } from './stageContract.js';

const RESUMABLE_STAGES = new Set(['CRAWL_READY', 'SELECTED_FOR_REDESIGN', 'CRAWL_FAILED']);

/** A re-run of a stage replaces its prior entry — stage history is a
 *  one-slot-per-stage audit trail, not an append log. */
export function mergeStageResult(results: StageGateResult[], r: StageGateResult): StageGateResult[] {
  const idx = results.findIndex((x) => x.stage === r.stage);
  if (idx >= 0) results[idx] = r; else results.push(r);
  return results;
}

/** Loads an existing run for resume: same row, same crawl artifact, no crawl.
 *  With force, the row's error is cleared and it is parked at CRAWL_READY for
 *  the continued run. */
export async function loadRunForResume(
  prisma: any,
  crawlRunId: string,
  leadId: string,
  force?: boolean,
): Promise<{ run: any; crawlResult: any; crawlJsonPath: string }> {
  const existingRun = await prisma.redesignRun.findUnique({
    where: { id: crawlRunId },
    include: { lead: true },
  });
  if (!existingRun) throw new Error(`Crawl run not found: ${crawlRunId}`);
  if (existingRun.leadId !== leadId) throw new Error(`Crawl run ${crawlRunId} does not belong to lead ${leadId}`);
  if (!force && !RESUMABLE_STAGES.has(existingRun.stage)) {
    throw new Error(`Crawl run ${crawlRunId} is already ${existingRun.stage}. Use force to regenerate.`);
  }
  if (!existingRun.crawlJsonPath) throw new Error(`Crawl run ${crawlRunId} has no crawl artifact`);

  const crawlJsonPath = existingRun.crawlJsonPath;
  const crawlResult = JSON.parse(await readFile(crawlJsonPath, 'utf8'));

  if (force) {
    await prisma.redesignRun.update({
      where: { id: existingRun.id },
      data: { errorMessage: null, stage: 'CRAWL_READY' },
    });
  }
  return { run: existingRun, crawlResult, crawlJsonPath };
}

/** Canonical site for a lead. The lead's own site link can point at an
 *  ARCHIVED or merged row after a canonical merge — resolve by domain with
 *  the same rule as the importer: never archived, never merged-away. */
export async function resolveCanonicalSite(prisma: any, lead: any): Promise<any | undefined> {
  let site = lead.site;
  const leadDomain = lead.websiteDomain || (lead.website || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if ((!site || site.mergedIntoSiteId || site.status === 'ARCHIVED') && leadDomain) {
    site = await prisma.site.findFirst({
      where: {
        mergedIntoSiteId: null,
        status: { not: 'ARCHIVED' },
        OR: [{ canonicalDomain: leadDomain }, { domain: leadDomain }],
      },
    }) || site;
  }
  return site;
}

/** The ACTIVE variant for a resumed run — preferred first, newest as
 *  fallback. Resolved from the DB because a resume that skips CMS_IMPORTED
 *  has no import output to carry the variant id. */
export async function resolveActiveVariant(prisma: any, siteId: string): Promise<any | undefined> {
  return prisma.demoVariant.findFirst({
    where: { siteId, status: 'ACTIVE' },
    orderBy: [{ isPreferred: 'desc' }, { createdAt: 'desc' }],
  });
}
