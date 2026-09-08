import type { Filters, PrimaryView } from './RadarFilters';

const GENERATION_STAGE_MAP: Record<string, string[]> = {
  NOT_SELECTED: ['NOT_SELECTED'],
  SELECTED: ['SELECTED_FOR_REDESIGN'],
  GENERATING: ['CRAWL_READY', 'CONTENT_EXTRACTED', 'CONTENT_TRANSFORMED', 'CMS_IMPORTED', 'SITE_RENDERED', 'AUDIT_DONE'],
  GENERATED: ['DEMO_GENERATED', 'DEMO_APPROVED', 'READY_TO_CONTACT'],
  FAILED: ['CRAWL_FAILED'],
};

// Mirrors FAILED_CHECKS_OR on the server: any terminal technical-stage
// failure, never merely RUNNING/PENDING work.
function qualificationFailed(lead: any): boolean {
  return (
    lead.websiteStatus === 'FAILED' ||
    lead.auditStatus === 'FAILED' ||
    lead.scoreStatus === 'FAILED' ||
    lead.visualAnalysis?.status === 'FAILED' ||
    lead.lighthouseReport?.status === 'FAILED'
  );
}

/**
 * Client-side mirror of the /api/leads filter semantics, used to decide
 * whether a mutated lead still belongs to the current view. Dimensions we
 * cannot evaluate locally (discoveryRunId membership) are treated as a
 * match — the next authoritative refresh will correct the row set.
 */
export function leadMatchesFilters(lead: any, filters: Filters, _view: PrimaryView): boolean {
  if (filters.q) {
    const s = filters.q.toLowerCase();
    const hay = [lead.companyName, lead.website, lead.websiteDomain, lead.phone, lead.address, lead.manualReviewNote]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(s)) return false;
  }
  if (filters.manual && (lead.manualReviewStatus || 'UNREVIEWED') !== filters.manual) return false;
  if (filters.websiteStatus && lead.websiteStatus !== filters.websiteStatus) return false;

  if (filters.qualificationStatus === 'READY' && !lead.readyForReview) return false;
  if (filters.qualificationStatus === 'PENDING' && (lead.websiteStatus !== 'FOUND' || lead.readyForReview)) return false;
  if (filters.qualificationStatus === 'FAILED' && !qualificationFailed(lead)) return false;
  // The server defaults non-FAILED views to websiteStatus=FOUND — a lead
  // whose viability hard-failed drifts out of every non-failed view.
  if (filters.qualificationStatus !== 'FAILED' && !filters.websiteStatus && lead.websiteStatus === 'FAILED') return false;

  const gs = filters.generationStatus;
  if (gs === 'READY_FOR_GENERATION') {
    if (!(lead.manualReviewStatus === 'GOOD' && lead.redesignStage && lead.redesignStage !== 'NOT_SELECTED')) return false;
  } else if (gs && GENERATION_STAGE_MAP[gs]) {
    if (!GENERATION_STAGE_MAP[gs].includes(lead.redesignStage || 'NOT_SELECTED')) return false;
  }
  return true;
}
