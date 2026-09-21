import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { RunStatus, StageStatus } from './types.mjs';
import { hashJson } from './manifest.mjs';

/**
 * @typedef {import('./types.mjs').RunStatus} RunStatus
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {object} RunError
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {object} CostRecord
 * @property {string} provider
 * @property {string} operation
 * @property {number} [requests]
 * @property {number} [inputTokens]
 * @property {number} [outputTokens]
 * @property {number} [credits]
 * @property {number} [reportedCost]
 * @property {number} [estimatedCost]
 * @property {string} [currency]
 */

/**
 * @typedef {object} Stage
 * @property {string} name
 * @property {string} status
 * @property {string} [provider]
 * @property {string} [startedAt]
 * @property {string} [completedAt]
 * @property {number} [durationMs]
 * @property {ArtifactRef[]} artifacts
 * @property {CostRecord[]} costs
 * @property {RunError[]} errors
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {object} SkillUsage
 * @property {string} skill
 * @property {string} source
 * @property {string} [version]
 * @property {string} stage
 * @property {string} [reason]
 */

/**
 * @typedef {object} GenerationRun
 * @property {string} id
 * @property {string} [leadId]
 * @property {string} [siteId]
 * @property {string} [demoVariantId]
 * @property {string} mode
 * @property {string} status
 * @property {string} sourceSnapshotId
 * @property {string} [intelligenceRunId]
 * @property {string} generationProvider
 * @property {string} generationVersion
 * @property {string} [designRecipeId]
 * @property {string} [siteBuildId]
 * @property {string} startedAt
 * @property {string} [completedAt]
 * @property {string} [gitCommit]
 * @property {Stage[]} stages
 * @property {CostRecord[]} costs
 * @property {SkillUsage[]} provenance
 * @property {ArtifactRef[]} artifacts
 * @property {RunError[]} errors
 * @property {Record<string, unknown>} [metadata]
 */

export class GenerationRunBuilder {
  /**
   * @param {Object} opts
   * @param {string} opts.sourceSnapshotId
   * @param {string} opts.generationProvider
   * @param {string} [opts.mode]
   * @param {string} [opts.generationVersion]
   * @param {string} [opts.leadId]
   * @param {string} [opts.siteId]
   * @param {string} [opts.demoVariantId]
   * @param {string} [opts.gitCommit]
   * @param {string} [opts.id]
   */
  constructor(opts) {
    /** @type {GenerationRun} */
    this.run = {
      id: opts.id ?? randomUUID(),
      leadId: opts.leadId,
      siteId: opts.siteId,
      demoVariantId: opts.demoVariantId,
      mode: opts.mode ?? 'SAFE',
      status: RunStatus.PENDING,
      sourceSnapshotId: opts.sourceSnapshotId,
      intelligenceRunId: undefined,
      generationProvider: opts.generationProvider,
      generationVersion: opts.generationVersion ?? 'unknown',
      designRecipeId: undefined,
      siteBuildId: undefined,
      startedAt: new Date().toISOString(),
      completedAt: undefined,
      gitCommit: opts.gitCommit,
      stages: [],
      costs: [],
      provenance: [],
      artifacts: [],
      errors: [],
      metadata: {},
    };
    this.currentStage = null;
  }

  /**
   * Start a stage.
   * @param {string} name
   * @param {Object} [opts]
   * @param {string} [opts.provider]
   * @returns {Stage}
   */
  startStage(name, opts = {}) {
    const stage = {
      name,
      status: StageStatus.RUNNING,
      provider: opts.provider,
      startedAt: new Date().toISOString(),
      completedAt: undefined,
      durationMs: undefined,
      artifacts: [],
      costs: [],
      errors: [],
      metadata: {},
    };
    this.run.stages.push(stage);
    this.currentStage = stage;
    this.run.status = RunStatus.RUNNING;
    return stage;
  }

  /**
   * Complete the current stage.
   * @param {string} status
   * @param {RunError} [error]
   */
  endStage(status, error) {
    if (!this.currentStage) return;
    const stage = this.currentStage;
    stage.status = status;
    stage.completedAt = new Date().toISOString();
    stage.durationMs = stage.startedAt
      ? new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime()
      : undefined;
    if (error) stage.errors.push(error);
    this.currentStage = null;
  }

  /**
   * Record an artifact on the current stage and the run.
   * @param {ArtifactRef} artifact
   */
  addArtifact(artifact) {
    this.run.artifacts.push(artifact);
    if (this.currentStage) this.currentStage.artifacts.push(artifact);
  }

  /**
   * Record a cost on the current stage and the run.
   * @param {CostRecord} cost
   */
  addCost(cost) {
    this.run.costs.push(cost);
    if (this.currentStage) this.currentStage.costs.push(cost);
  }

  /**
   * Record skill usage provenance.
   * @param {SkillUsage} usage
   */
  addSkillUsage(usage) {
    this.run.provenance.push(usage);
  }

  /**
   * Record a run-level error.
   * @param {RunError} error
   */
  addError(error) {
    this.run.errors.push(error);
  }

  /**
   * Mark the run as completed with an overall status.
   * @param {string} status
   */
  complete(status) {
    this.run.status = status;
    this.run.completedAt = new Date().toISOString();
  }

  /**
   * Compute a deterministic fingerprint of the run metadata.
   * @returns {string}
   */
  computeFingerprint() {
    return hashJson({
      id: this.run.id,
      sourceSnapshotId: this.run.sourceSnapshotId,
      generationProvider: this.run.generationProvider,
      mode: this.run.mode,
      stages: this.run.stages.map((s) => ({ name: s.name, status: s.status })),
      artifacts: this.run.artifacts.map((a) => ({ type: a.type, sha256: a.sha256 })),
    });
  }

  /**
   * Persist the run manifest.
   * @param {string} root
   */
  async save(root) {
    const path = resolve(root, `generation-run-${this.run.id}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(this.run, null, 2), 'utf8');
    return path;
  }

  /**
   * Get the built run object.
   * @returns {GenerationRun}
   */
  build() {
    return this.run;
  }
}

/**
 * Recompute overall run status from stages.
 * @param {GenerationRun} run
 * @returns {string}
 */
export function deriveRunStatus(run) {
  if (run.stages.length === 0) return run.status;
  const failed = run.stages.some((s) => s.status === StageStatus.FAILED);
  const allSuccess = run.stages.every((s) => s.status === StageStatus.SUCCESS || s.status === StageStatus.SKIPPED);
  if (failed && allSuccess) return RunStatus.SUCCESS;
  if (failed) return RunStatus.PARTIAL;
  if (allSuccess) return RunStatus.SUCCESS;
  return run.status;
}
