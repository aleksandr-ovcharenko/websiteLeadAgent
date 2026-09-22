// V3.7.2 — generation pipeline stage-gate contract.
//
// The generation state machine is:
//
//   CRAWLED → EXTRACTED → CONTENT_VALIDATED → GRAPH_BUILT
//     → CMS_IMPORT_READY → CMS_IMPORTED → RENDERED
//     → RENDER_VALIDATED → VISUAL_VALIDATED → HUMAN_REVIEW_READY
//
// V3.7.3 adds VISUAL_VALIDATED: deterministic Playwright DOM checks (hero
// integrity, content density, leaked strings, brand grounding, geometry) with
// at most two bounded repair passes. HUMAN_REVIEW_READY stays unreachable
// while rendered output is visibly broken.
//
// Every stage produces a typed StageGateResult. A stage with status 'FAIL'
// stops the run — HUMAN_REVIEW_READY is unreachable while a blocking error
// exists. Results persist on RedesignRun.stageResults and are emitted as
// FACTORY_GATE_* activity events so Forge/Factory can render gates per run.

export type PipelineStage =
  | 'CRAWLED'
  | 'EXTRACTED'
  | 'CONTENT_VALIDATED'
  | 'GRAPH_BUILT'
  | 'CMS_IMPORT_READY'
  | 'CMS_IMPORTED'
  | 'RENDERED'
  | 'RENDER_VALIDATED'
  | 'VISUAL_VALIDATED'
  | 'HUMAN_REVIEW_READY';

export const STAGE_ORDER: PipelineStage[] = [
  'CRAWLED',
  'EXTRACTED',
  'CONTENT_VALIDATED',
  'GRAPH_BUILT',
  'CMS_IMPORT_READY',
  'CMS_IMPORTED',
  'RENDERED',
  'RENDER_VALIDATED',
  'VISUAL_VALIDATED',
  'HUMAN_REVIEW_READY',
];

export type GateStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

export interface StageGateResult {
  status: GateStatus;
  stage: PipelineStage;
  errors: string[];
  warnings: string[];
  metrics: Record<string, number | string | boolean>;
  artifactPaths: string[];
  /** Stage a retry should restart from. On PASS this is the next stage;
   *  on FAIL it is the owning stage itself. */
  retryFromStage: PipelineStage;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export function nextStage(stage: PipelineStage): PipelineStage {
  const i = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
}

export function gateResult(
  stage: PipelineStage,
  input: {
    errors?: string[];
    warnings?: string[];
    metrics?: Record<string, number | string | boolean>;
    artifactPaths?: string[];
    startedAt?: number;
  },
): StageGateResult {
  const startedAt = input.startedAt ?? Date.now();
  const finished = Date.now();
  const errors = input.errors ?? [];
  const warnings = input.warnings ?? [];
  return {
    status: errors.length ? 'FAIL' : warnings.length ? 'PASS_WITH_WARNINGS' : 'PASS',
    stage,
    errors,
    warnings,
    metrics: input.metrics ?? {},
    artifactPaths: input.artifactPaths ?? [],
    retryFromStage: errors.length ? stage : nextStage(stage),
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - startedAt,
  };
}

/** RedesignStage enum value the run row should carry while/after a stage. */
export const STAGE_TO_RUN_STAGE: Record<PipelineStage, string> = {
  CRAWLED: 'CRAWL_READY',
  EXTRACTED: 'CONTENT_EXTRACTED',
  CONTENT_VALIDATED: 'CONTENT_VALIDATED',
  GRAPH_BUILT: 'GRAPH_BUILT',
  CMS_IMPORT_READY: 'CMS_IMPORT_READY',
  CMS_IMPORTED: 'CMS_IMPORTED',
  RENDERED: 'SITE_RENDERED',
  RENDER_VALIDATED: 'RENDER_VALIDATED',
  VISUAL_VALIDATED: 'VISUAL_VALIDATED',
  HUMAN_REVIEW_READY: 'HUMAN_REVIEW_READY',
};

/** Options accepted by generateSite for stage-resume. */
export const RESUMABLE_STAGES: PipelineStage[] = [
  'EXTRACTED',
  'CONTENT_VALIDATED',
  'GRAPH_BUILT',
  'CMS_IMPORT_READY',
  'CMS_IMPORTED',
  'RENDERED',
  'RENDER_VALIDATED',
  'VISUAL_VALIDATED',
];

/** True when `stage` can resume using only stored artifacts (no recrawl). */
export function stageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}
