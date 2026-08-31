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
  RUNNING: '⏵',
  NOT_FOUND: '✕',
  UNREVIEWED: '○',
};

export function stageColor(status: string) {
  if (['SUCCESS', 'FOUND'].includes(status)) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (['RUNNING'].includes(status)) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (['PENDING', 'UNREVIEWED', 'UNKNOWN'].includes(status)) return 'text-amber-700 bg-amber-50 border-amber-200';
  if (['FAILED', 'NOT_FOUND'].includes(status)) return 'text-red-700 bg-red-50 border-red-200';
  return 'text-stone-600 bg-stone-50 border-stone-200';
}

export interface QualificationStage {
  id: string;
  label: string;
  status: string;
  reason?: string;
}

export interface QualificationResult {
  stages: QualificationStage[];
  firstBlocking: QualificationStage | null;
  firstBlockingIndex: number;
  allQualified: boolean;
  readyForReview: boolean;
}

export function computeQualification(lead: any, optimistic: Record<string, 'RUNNING' | 'PENDING'> = {}): QualificationResult {
  const hasWebsite = !!lead.website;
  const websiteStatus = lead.websiteStatus || (hasWebsite ? 'FOUND' : 'NOT_FOUND');
  const websiteReason = lead.websiteIneligibilityReason;
  const auditStatus = (optimistic.audit || lead.auditStatus || 'PENDING') as string;
  const auditReason = lead.auditErrorMessage;
  const screenshotsStatus = optimistic.audit || (lead.auditStatus === 'SUCCESS' ? 'SUCCESS' : (lead.auditStatus === 'FAILED' ? 'FAILED' : 'PENDING'));
  const screenshotsReason = lead.auditStatus === 'FAILED' ? lead.auditErrorMessage : undefined;
  const lighthouseStatus = optimistic.lighthouse || (lead.lighthouseReport ? 'SUCCESS' : (lead.auditStatus === 'SUCCESS' ? 'PENDING' : 'PENDING'));
  const visual = lead.visualAnalysis || {};
  const aiStatus = (optimistic.ai || visual.status || 'PENDING') as string;
  const aiReason = visual.errorMessage;
  const scoreStatus = (optimistic.scoring || lead.scoreStatus || 'PENDING') as string;
  const scoreReason = (lead.scoreDetailsV2 as any)?.error;

  const stages: QualificationStage[] = [
    { id: 'website', label: 'Website', status: websiteStatus, reason: websiteReason },
    { id: 'audit', label: 'Audit', status: auditStatus, reason: auditReason },
    { id: 'screenshots', label: 'Screenshots', status: screenshotsStatus, reason: screenshotsReason },
    { id: 'lighthouse', label: 'Lighthouse', status: lighthouseStatus },
    { id: 'ai', label: 'AI analysis', status: aiStatus, reason: aiReason },
    { id: 'scoring', label: 'Scoring', status: scoreStatus, reason: scoreReason },
  ];

  const validForReview = new Set(['SUCCESS', 'SKIPPED', 'FOUND']);
  const firstBlockingIndex = stages.findIndex(s => !validForReview.has(s.status));
  const firstBlocking = firstBlockingIndex >= 0 ? stages[firstBlockingIndex] : null;
  const allQualified = firstBlockingIndex === -1;
  const readyForReview = allQualified;

  return { stages, firstBlocking, firstBlockingIndex, allQualified, readyForReview };
}
