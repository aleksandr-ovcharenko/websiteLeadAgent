import { RedesignStage } from '@prisma/client';

/**
 * Human-facing UI labels for Factory pipeline stages.
 * Keep this as the single source of truth for pipeline terminology.
 */
export const PIPELINE_STAGE_LABELS: Record<RedesignStage, string> = {
  [RedesignStage.NOT_SELECTED]: 'Not started',
  [RedesignStage.SELECTED_FOR_REDESIGN]: 'Selected for redesign',
  [RedesignStage.CONTENT_EXTRACTED]: 'Preparing content',
  [RedesignStage.CONTENT_TRANSFORMED]: 'Preparing content',
  [RedesignStage.CMS_IMPORTED]: 'Preparing Studio',
  [RedesignStage.SITE_RENDERED]: 'Building website',
  [RedesignStage.AUDIT_DONE]: 'Checking website',
  [RedesignStage.DEMO_GENERATED]: 'Building website',
  [RedesignStage.DEMO_APPROVED]: 'Ready for review',
  [RedesignStage.READY_TO_CONTACT]: 'Ready for review',
};

export function getPipelineStageLabel(stage: RedesignStage | string | null | undefined): string {
  if (!stage) return 'Not started';
  return PIPELINE_STAGE_LABELS[stage as RedesignStage] ?? String(stage).toLowerCase().replace(/_/g, ' ');
}
