/**
 * Eligibility for the bulk "Run AI / Re-run AI" action.
 * This is the shared source of truth for which selected Leads can be sent to
 * visual analysis. Mixed selections are expected; the result for each ID is
 * computed independently.
 */
export interface BulkAiEligibility {
  result: 'STARTED' | 'SKIPPED' | 'FAILED';
  reason?: string;
  operationId?: string;
}

export function getBulkAiEligibility(lead: {
  id: string;
  website?: string | null;
  websiteStatus?: string;
  auditStatus?: string;
  manualReviewStatus?: string;
  visualAnalysis?: { status?: string } | null;
}, activeOperations: { operationId: string }[] = []): BulkAiEligibility {
  if (!lead) return { result: 'FAILED', reason: 'not_found' };
  if (lead.manualReviewStatus === 'BAD') return { result: 'SKIPPED', reason: 'rejected' };
  if (lead.websiteStatus === 'FAILED' || !lead.website) return { result: 'SKIPPED', reason: 'no_viable_website' };
  if (lead.auditStatus !== 'SUCCESS') return { result: 'SKIPPED', reason: 'audit_not_success' };
  if (activeOperations.some((o) => o.operationId === 'RUN_VISUAL_ANALYSIS')) {
    return { result: 'SKIPPED', reason: 'ai_running' };
  }
  // If already success, force=true produces a rerun;
  // a previous FAILED visual analysis is an explicit retry path.
  const already = lead.visualAnalysis?.status;
  let reason = 'first_run';
  if (already === 'SUCCESS') reason = 'rerun';
  else if (already === 'FAILED') reason = 'retry';
  return {
    result: 'STARTED',
    reason,
  };
}
