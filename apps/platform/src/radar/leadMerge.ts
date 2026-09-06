import type { Filters, PrimaryView } from './RadarFilters';

/**
 * Merge a background reconciliation payload into the currently displayed list
 * without disturbing the user's spatial model of the table:
 *
 * - rows that still exist keep their position and get patched in place;
 * - rows absent from the payload are dropped (legitimately removed or
 *   filtered out by a server-side change);
 * - brand-new rows are appended at the end so existing rows never move
 *   under the cursor. An explicit refresh (filter/sort/view change)
 *   applies the authoritative server ordering.
 */
export function mergeLeadsPreserveOrder(prev: any[], items: any[]): any[] {
  if (prev.length === 0) return items;
  const byId = new Map(items.map((l) => [l.id, l]));
  // Existing rows keep their position and get patched in place. A row absent
  // from the payload is NOT dropped: background reconciliation may not remove
  // what the user is looking at — the row disappears at the next explicit
  // boundary (filter/sort/view change or manual refresh), not mid-session.
  const merged = prev.map((l) => byId.get(l.id) ?? l);
  const prevIds = new Set(prev.map((l) => l.id));
  for (const l of items) {
    if (!prevIds.has(l.id)) merged.push(l);
  }
  return merged;
}

/**
 * Deterministic selection after the selected row is deliberately removed
 * from the current view: prefer the next row in the displayed order, fall
 * back to the previous row, else nothing. Never jumps to an unrelated row
 * (e.g. the lead currently being qualified).
 */
export function pickAdjacentSelection(order: string[], removedId: string): string | null {
  const i = order.indexOf(removedId);
  if (i < 0) return null;
  return order[i + 1] ?? order[i - 1] ?? null;
}

const GENERATION_STAGE_MAP: Record<string, string[]> = {
  NOT_SELECTED: ['NOT_SELECTED'],
  SELECTED: ['SELECTED_FOR_REDESIGN'],
  GENERATING: ['CRAWL_READY', 'CONTENT_EXTRACTED', 'CONTENT_TRANSFORMED', 'CMS_IMPORTED', 'SITE_RENDERED', 'AUDIT_DONE'],
  GENERATED: ['DEMO_GENERATED', 'DEMO_APPROVED', 'READY_TO_CONTACT'],
  FAILED: ['CRAWL_FAILED'],
};

function qualificationFailed(lead: any): boolean {
  return (
    lead.auditStatus === 'FAILED' ||
    lead.scoreStatus === 'FAILED' ||
    lead.visualAnalysis?.status === 'FAILED'
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

  const gs = filters.generationStatus;
  if (gs === 'READY_FOR_GENERATION') {
    if (!(lead.manualReviewStatus === 'GOOD' && lead.redesignStage && lead.redesignStage !== 'NOT_SELECTED')) return false;
  } else if (gs && GENERATION_STAGE_MAP[gs]) {
    if (!GENERATION_STAGE_MAP[gs].includes(lead.redesignStage || 'NOT_SELECTED')) return false;
  }
  return true;
}
