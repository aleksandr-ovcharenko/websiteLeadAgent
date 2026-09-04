export const STAGE_LABELS: Record<string, string> = {
  website: 'Website',
  audit: 'Audit',
  screenshots: 'Screenshots',
  lighthouse: 'Lighthouse',
  ai: 'AI analysis',
  scoring: 'Scoring',
};

export const STAGE_ICONS: Record<string, string> = {
  FOUND: '✓',
  SUCCESS: '✓',
  SKIPPED: '⊘',
  FAILED: '✕',
  PENDING: '○',
  WAITING: '◌',
  RUNNING: '◌',
  NOT_FOUND: '✕',
  UNREVIEWED: '○',
};

export function stageColor(status: string) {
  if (['SUCCESS', 'FOUND'].includes(status)) return 'text-success bg-success-subtle border-success-subtle';
  if (['RUNNING'].includes(status)) return 'text-info bg-info-subtle border-info-subtle';
  if (['PENDING', 'UNREVIEWED', 'UNKNOWN'].includes(status)) return 'text-warning bg-warning-subtle border-warning-subtle';
  if (['WAITING'].includes(status)) return 'text-text-muted bg-surface-raised border-border';
  if (['FAILED', 'NOT_FOUND'].includes(status)) return 'text-danger bg-danger-subtle border-danger-subtle';
  return 'text-text bg-surface-raised border-border';
}

export interface QualificationStage {
  id: string;
  label: string;
  status: string;
  reason?: string;
  waitingFor?: string[];
}

export interface QualificationResult {
  stages: QualificationStage[];
  firstBlocking: QualificationStage | null;
  firstBlockingIndex: number;
  allQualified: boolean;
  readyForReview: boolean;
}

const STAGE_ORDER = ['website', 'audit', 'screenshots', 'lighthouse', 'ai', 'scoring'] as const;

const OVERRIDES: Record<string, string> = {
  website: 'Website',
  audit: 'Audit',
  screenshots: 'Screenshots',
  lighthouse: 'Lighthouse',
  ai: 'AI analysis',
  scoring: 'Scoring',
};

function runningOperationStage(lead: any, op: any): string | null {
  if (!op) return null;
  const oid = op.operationId;
  if (oid === 'AUDIT_WEBSITE' || oid === 'RUN_FULL_QUALIFICATION') {
    if (lead.auditStatus !== 'SUCCESS') return 'audit';
    if (!lead.lighthouseReport) return 'lighthouse';
    if (lead.visualAnalysis?.status !== 'SUCCESS') return 'ai';
    if (lead.scoreStatus !== 'SUCCESS') return 'scoring';
    return 'audit';
  }
  if (oid === 'RUN_LIGHTHOUSE') return 'lighthouse';
  if (oid === 'RUN_VISUAL_ANALYSIS') return 'ai';
  if (oid === 'RECALCULATE_SCORE') return 'scoring';
  return null;
}

export function computeQualification(lead: any, optimistic: Record<string, 'RUNNING' | 'PENDING'> = {}): QualificationResult {
  const active = (lead.activeOperations || []) as any[];
  const runningStage = optimistic.audit ? 'audit' : runningOperationStage(lead, active[0]) || (active.length > 0 ? 'audit' : null);
  const activeByStage = new Map<string, any>();
  for (const op of active) {
    const stage = runningOperationStage(lead, op);
    if (stage) activeByStage.set(stage, op);
  }

  const hasWebsite = !!lead.website;
  const websiteStatus = lead.websiteStatus || (hasWebsite ? 'FOUND' : 'NOT_FOUND');
  const websiteReason = lead.websiteIneligibilityReason;
  const auditStatus = (optimistic.audit || lead.auditStatus || 'PENDING') as string;
  const auditReason = lead.auditErrorMessage;
  const screenshotsStatus = optimistic.audit || (lead.auditStatus === 'SUCCESS' ? 'SUCCESS' : (lead.auditStatus === 'FAILED' ? 'FAILED' : 'PENDING'));
  const screenshotsReason = lead.auditStatus === 'FAILED' ? lead.auditErrorMessage : undefined;
  const rawLighthouse = lead.lighthouseReport?.status || (lead.auditStatus === 'SUCCESS' ? 'PENDING' : 'PENDING');
  const lighthouseReason = lead.lighthouseReport?.error?.message || lead.lighthouseReport?.error;
  const visual = lead.visualAnalysis || {};
  const rawAi = visual.status || 'PENDING';
  const rawScore = lead.scoreStatus || 'PENDING';

  const rawStatuses: Record<string, string> = {
    website: websiteStatus,
    audit: auditStatus,
    screenshots: screenshotsStatus,
    lighthouse: rawLighthouse,
    ai: rawAi,
    scoring: rawScore,
  };

  const validForReview = new Set(['SUCCESS', 'SKIPPED', 'FOUND', 'PENDING']);
  const firstBlockingIndex = STAGE_ORDER.findIndex(s => !['SUCCESS', 'SKIPPED', 'FOUND'].includes(rawStatuses[s]));
  const firstBlocking = firstBlockingIndex >= 0 ? STAGE_ORDER[firstBlockingIndex] : null;

  const stages: QualificationStage[] = STAGE_ORDER.map((id, i) => {
    const base = rawStatuses[id];
    const optimisticStatus = optimistic[id as keyof typeof optimistic];
    let status: string = optimisticStatus || base;
    const op = activeByStage.get(id);
    if (op || (runningStage === id && !optimisticStatus)) {
      if (status !== 'SUCCESS' && status !== 'FAILED' && status !== 'NOT_FOUND') status = 'RUNNING';
    }
    const label = OVERRIDES[id];
    const incompleteBefore = STAGE_ORDER.slice(0, i).filter((s) => !['SUCCESS', 'SKIPPED', 'FOUND'].includes(rawStatuses[s]));
    if (status === 'PENDING' && incompleteBefore.length > 0) {
      status = 'WAITING';
    }
    const waitingFor = status === 'WAITING' ? incompleteBefore.map(s => OVERRIDES[s]) : undefined;
    const reason =
      id === 'audit' ? auditReason :
      id === 'screenshots' ? screenshotsReason :
      id === 'lighthouse' ? lighthouseReason :
      id === 'ai' ? visual.errorMessage :
      id === 'scoring' ? (lead.scoreDetailsV2 as any)?.error :
      websiteReason;
    return { id, label, status, reason, waitingFor };
  });

  const firstBlockingStage = firstBlocking ? stages[firstBlockingIndex] : null;
  const allQualified = firstBlocking === null;
  const readyForReview = allQualified;

  return { stages, firstBlocking: firstBlockingStage, firstBlockingIndex, allQualified, readyForReview };
}
