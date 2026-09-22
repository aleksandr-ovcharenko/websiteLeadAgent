-- V3.7.2: pipeline stage-gate contract.
-- New RedesignStage values for the gated generation state machine and a
-- per-run stageResults JSON column holding ordered StageGateResult records.

ALTER TYPE "RedesignStage" ADD VALUE IF NOT EXISTS 'CONTENT_VALIDATED';
ALTER TYPE "RedesignStage" ADD VALUE IF NOT EXISTS 'GRAPH_BUILT';
ALTER TYPE "RedesignStage" ADD VALUE IF NOT EXISTS 'CMS_IMPORT_READY';
ALTER TYPE "RedesignStage" ADD VALUE IF NOT EXISTS 'RENDER_VALIDATED';
ALTER TYPE "RedesignStage" ADD VALUE IF NOT EXISTS 'HUMAN_REVIEW_READY';

ALTER TABLE "RedesignRun" ADD COLUMN IF NOT EXISTS "stageResults" JSONB;
