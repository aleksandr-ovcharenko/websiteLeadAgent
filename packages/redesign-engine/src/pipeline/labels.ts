import { RedesignStage } from '@prisma/client';

/**
 * Human-facing UI labels for Factory pipeline stages.
 * Keep this as the single source of truth for pipeline terminology.
 */
export const PIPELINE_STAGE_LABELS: Record<RedesignStage, string> = {
  [RedesignStage.NOT_SELECTED]: 'Not started',
  [RedesignStage.SELECTED_FOR_REDESIGN]: 'Lead selected',
  [RedesignStage.CRAWL_READY]: 'Crawl ready',
  [RedesignStage.CRAWL_FAILED]: 'Crawl failed',
  [RedesignStage.CONTENT_EXTRACTED]: 'Content extraction',
  [RedesignStage.CONTENT_TRANSFORMED]: 'Content transformation',
  [RedesignStage.CMS_IMPORTED]: 'CMS import',
  [RedesignStage.SITE_RENDERED]: 'Website generation',
  [RedesignStage.AUDIT_DONE]: 'Validation',
  [RedesignStage.DEMO_GENERATED]: 'Demo ready',
  [RedesignStage.DEMO_APPROVED]: 'Demo approved',
  [RedesignStage.READY_TO_CONTACT]: 'Ready to contact',
};

export function getPipelineStageLabel(stage: RedesignStage | string | null | undefined): string {
  if (!stage) return 'Not started';
  return PIPELINE_STAGE_LABELS[stage as RedesignStage] ?? String(stage).toLowerCase().replace(/_/g, ' ');
}
